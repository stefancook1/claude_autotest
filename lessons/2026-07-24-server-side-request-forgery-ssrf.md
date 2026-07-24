# Server-Side Request Forgery (SSRF)
**Category:** App Security
**Date:** 2026-07-24
**Difficulty:** Intermediate

---

## What It Is
Server-Side Request Forgery (SSRF) occurs when an attacker can make a server perform HTTP requests on their behalf — to destinations the attacker chooses. The server acts as a proxy: it fetches a URL supplied (or influenced) by user input, then returns the response to the attacker. Because the request originates from the server itself, it can reach internal services, cloud metadata endpoints, and other resources that are firewalled off from the outside world.

## Why It Matters
SSRF is one of the most impactful modern web vulnerabilities and was added to the OWASP Top 10 in 2021 (A10). The 2019 Capital One breach — exposing 100 million customer records — was triggered by an SSRF against the AWS EC2 Instance Metadata Service (IMDS), which leaked IAM credentials the attacker used to pivot into S3 buckets.

## Practical Example

### Vulnerable code (Node.js/Express)
```javascript
// Endpoint that fetches a preview of a user-supplied URL
app.post('/fetch-preview', async (req, res) => {
  const { url } = req.body;
  // VULNERABLE: no validation on the destination
  const response = await axios.get(url);
  res.json({ content: response.data });
});
```

### Attack 1 — Cloud metadata exfiltration
```
POST /fetch-preview
{ "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/ec2-role" }
```
The server dutifully fetches the AWS metadata endpoint and returns the IAM access key, secret, and session token.

### Attack 2 — Internal network pivot
```
POST /fetch-preview
{ "url": "http://10.0.0.5:8080/admin" }
```
The attacker probes an internal admin panel that is not exposed to the internet.

### Attack 3 — Port scanning via timing
```
# Fast response (port open):  { "url": "http://internal-db:5432/" }
# Timeout (port closed):      { "url": "http://internal-db:9999/" }
```
By measuring response times, attackers can map internal network topology.

### Bypass tricks for naive blocklists
```
http://[::ffff:169.254.169.254]/latest/   # IPv6-mapped IPv4
http://169.254.169.254.nip.io/latest/     # DNS rebinding
http://0xA9FEA9FE/latest/                 # Hex encoding of 169.254.169.254
http://2852039166/latest/                 # Decimal encoding
```

## How to Defend

- **Allowlist, not blocklist**: Define the exact external hosts and schemes your application legitimately needs to fetch. Reject everything else. Blocklists are trivially bypassed (see encodings above).
- **Disable redirects or validate each hop**: HTTP redirects can point a validated URL to a private destination. Either follow zero redirects or re-validate the destination at every hop.
- **Block private/link-local ranges at the network layer**: Use egress firewall rules on your application servers to prevent outbound connections to RFC 1918 (10.x, 172.16-31.x, 192.168.x), 169.254.x.x, and ::1 ranges — defense in depth if allowlisting fails.
- **Enforce IMDSv2 on cloud instances**: AWS IMDSv2 requires a PUT request to obtain a session token before metadata can be read; a simple SSRF GET against the metadata endpoint returns nothing. Enable it on all EC2 instances.
- **Resolve and validate after DNS**: After resolving a hostname to an IP, check the IP against your blocklist *before* making the connection. This closes the DNS rebinding gap.

## Today's Challenge

1. Set up a small local HTTP server (`python3 -m http.server 9000`) and write a quick Node.js or Python script that takes a URL from the command line and fetches it.
2. Try fetching `http://localhost:9000/` through your script — observe that it succeeds.
3. Now add an allowlist check that rejects any URL whose resolved IP is in a private range. Use Python's `ipaddress` module (`ipaddress.ip_address(resolved_ip).is_private`) to test.
4. Bonus: attempt a bypass using `http://0177.0.0.1/` (octal encoding of 127.0.0.1) and fix your validator to catch it.

## Key Takeaway
SSRF turns your own server into an attacker's proxy — allowlist outbound destinations, validate after DNS resolution, and assume any unvalidated URL fetch is a potential pivot into your internal network.
