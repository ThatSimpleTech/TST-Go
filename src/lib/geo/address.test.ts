import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanAddress, looksLikeStreetAddress, parseCensus } from "./address.ts";

test("strips apartment and suite numbers", () => {
  assert.equal(
    cleanAddress("123 Main St Apt 4B, Springfield, IL 62701"),
    "123 Main St, Springfield, IL 62701",
  );
  assert.equal(cleanAddress("123 Main St #12, Springfield IL"), "123 Main St, Springfield IL");
  assert.equal(cleanAddress("500 Oak Ave, Unit 3, Austin, TX"), "500 Oak Ave, Austin, TX");
  assert.equal(cleanAddress("42 Suite Rd, Ste. 200, Dover, DE"), "42 Suite Rd, Dover, DE");
  assert.equal(cleanAddress("77 Lotus Ln, Lot 9, Ocala FL"), "77 Lotus Ln, Ocala FL");
  assert.equal(cleanAddress("300 Unit Rd"), "300 Unit Rd");
  assert.equal(cleanAddress("Navy Pier"), "Navy Pier");
});

test("spots street addresses", () => {
  assert.ok(looksLikeStreetAddress("123 Main St, Springfield, IL"));
  assert.ok(looksLikeStreetAddress("12B Baker St"));
  assert.ok(!looksLikeStreetAddress("Chicago"));
  assert.ok(!looksLikeStreetAddress("Navy Pier"));
});

test("reads a US Census geocoder response", () => {
  const hits = parseCensus({
    result: {
      addressMatches: [
        {
          matchedAddress: "4600 SILVER HILL RD, WASHINGTON, DC, 20233",
          coordinates: { x: -76.92748724230096, y: 38.84601622386617 },
        },
      ],
    },
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.name, "4600 Silver Hill Rd");
  assert.equal(hits[0]!.detail, "Washington, DC, 20233");
  assert.ok(Math.abs(hits[0]!.lat - 38.846) < 0.001);
  assert.ok(Math.abs(hits[0]!.lng + 76.9275) < 0.001);
  assert.deepEqual(parseCensus({}), []);
});
