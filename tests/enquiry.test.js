import test from "node:test";
import assert from "node:assert/strict";
import { buildEnquiry, isSpam, signPayload, verifySignature, signFileLink, checkFileLink, notificationEmail } from "../api/_lib/enquiry.js";

test("valid quote builds a CRM record", () => {
  const { errors, enquiry } = buildEnquiry({ form: "quote", name: " Jane Smith ", company: "Acme", email: "Jane@Acme.co.uk", phone: "01234 567890", service: "Injection moulding", volume: "Low volume", message: "10,000 trays\nin PP", utm_source: "google", gclid: "abc" }, { country: "GB" });
  assert.deepEqual(errors, {});
  assert.equal(enquiry.form, "quote");
  assert.equal(enquiry.contact.email, "jane@acme.co.uk");
  assert.equal(enquiry.contact.name, "Jane Smith");
  assert.equal(enquiry.enquiry.message, "10,000 trays\nin PP");
  assert.equal(enquiry.attribution.gclid, "abc");
  assert.match(enquiry.id, /^[0-9a-f-]{36}$/);
});

test("missing fields are reported", () => {
  const { errors } = buildEnquiry({ form: "contact", email: "nope" });
  assert.ok(errors.email && errors.name && errors.message);
  assert.deepEqual(buildEnquiry({ form: "newsletter", email: "a@b.co" }).errors, {});
});

test("spam checks", () => {
  assert.equal(isSpam({ website: "x" }), "honeypot");
  assert.equal(isSpam({ elapsed_ms: 900 }), "too fast");
  assert.equal(isSpam({ elapsed_ms: 9000, message: "hello" }), null);
});

test("webhook signature round trip", () => {
  const raw = JSON.stringify({ a: 1 });
  const { timestamp, signature } = signPayload("s3cret", raw);
  assert.ok(verifySignature("s3cret", raw, timestamp, signature));
  assert.ok(!verifySignature("wrong", raw, timestamp, signature));
  assert.ok(!verifySignature("s3cret", raw + " ", timestamp, signature));
  assert.ok(!verifySignature("s3cret", raw, String(Number(timestamp) - 3600), signPayload("s3cret", raw, Number(timestamp) - 3600).signature));
});

test("file links are signed and checked", () => {
  const { url } = signFileLink("https://ertone.co.uk", "k", "enquiries/2026-10/part-abc.step");
  const q = new URL(url).searchParams;
  assert.ok(checkFileLink("k", q.get("p"), q.get("e"), q.get("s")));
  assert.ok(!checkFileLink("k", "enquiries/2026-10/other.step", q.get("e"), q.get("s")));
  assert.ok(!checkFileLink("k", "../secret", q.get("e"), q.get("s")));
});

test("notification email escapes input", () => {
  const { enquiry } = buildEnquiry({ form: "contact", name: "<b>Bob</b>", email: "bob@x.com", message: "<script>x</script>" });
  const m = notificationEmail(enquiry);
  assert.ok(!m.html.includes("<script>"));
  assert.ok(m.html.includes("&lt;b&gt;Bob"));
});
