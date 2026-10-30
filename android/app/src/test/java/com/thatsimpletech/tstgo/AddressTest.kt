package com.thatsimpletech.tstgo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

class AddressTest {
    @Test
    fun stripsUnitNumbers() {
        assertEquals("123 Main St, Springfield, IL 62701", cleanAddress("123 Main St Apt 4B, Springfield, IL 62701"))
        assertEquals("123 Main St, Springfield IL", cleanAddress("123 Main St #12, Springfield IL"))
        assertEquals("500 Oak Ave, Austin, TX", cleanAddress("500 Oak Ave, Unit 3, Austin, TX"))
        assertEquals("42 Suite Rd, Dover, DE", cleanAddress("42 Suite Rd, Ste. 200, Dover, DE"))
        assertEquals("77 Lotus Ln, Ocala FL", cleanAddress("77 Lotus Ln, Lot 9, Ocala FL"))
        assertEquals("10 Floral Ave, Troy NY", cleanAddress("10 Floral Ave, Apt B, Troy NY"))
        assertEquals("300 Unit Rd", cleanAddress("300 Unit Rd"))
        assertEquals("Navy Pier", cleanAddress("Navy Pier"))
    }

    @Test
    fun spotsStreetAddresses() {
        assertTrue(looksLikeStreetAddress("123 Main St, Springfield, IL"))
        assertTrue(looksLikeStreetAddress("12B Baker St"))
        assertTrue(looksLikeStreetAddress("8600 Rockville Pike 20894"))
        assertFalse(looksLikeStreetAddress("Chicago"))
        assertFalse(looksLikeStreetAddress("Navy Pier"))
    }

    /**
     * Hits the real search services, so it only runs when GEOCODE_LIVE=1 (CI sets it).
     * Writes a side-by-side report: OpenStreetMap only (old) vs with the US Census (new).
     */
    @Test
    fun liveAddressSearch() {
        assumeTrue(System.getenv("GEOCODE_LIVE") == "1")
        val cases = listOf(
            "4600 Silver Hill Rd, Washington, DC 20233",
            "413 S 8th St, Springfield, IL 62701",
            "339 N Oak Park Ave, Oak Park, IL 60302",
            "951 Chicago Ave, Oak Park, IL 60302",
            "3159 W 11th St, Cleveland, OH 44109",
            "351 Farmington Ave, Hartford, CT 06105",
            "3764 Elvis Presley Blvd, Memphis, TN 38116",
            "1060 W Addison St, Chicago, IL 60613",
            "1060 west addison street chicago il",
            "8600 Rockville Pike 20894",
            "600 Montgomery St Suite 5, San Francisco, CA",
            "1 Microsoft Way #100, Redmond, WA",
            "2 15th St NW, Washington, DC 20024",
            "Navy Pier",
        )
        val sb = StringBuilder("# Address search, live\n\n")
        sb.append("| Query | Old (OpenStreetMap only) | New |\n|---|---|---|\n")
        var newFound = 0
        for (q in cases) {
            val old = runCatching { searchPlaces(q, useCensus = false).firstOrNull() }.getOrNull()
            Thread.sleep(1200)
            val new = runCatching { searchPlaces(q).firstOrNull() }.getOrNull()
            Thread.sleep(1200)
            if (new != null) newFound++
            sb.append("| ").append(q).append(" | ").append(describe(old)).append(" | ").append(describe(new)).append(" |\n")
        }
        sb.append("\nNew search found ").append(newFound).append(" of ").append(cases.size).append(".\n")
        val out = File(System.getenv("GEOCODE_REPORT") ?: "build/geocode-report.md")
        out.parentFile?.mkdirs()
        out.writeText(sb.toString())
        println(sb)
    }

    private fun describe(hit: PlaceHit?): String =
        if (hit == null) {
            "**not found**"
        } else {
            "${hit.name}, ${hit.detail} (${"%.5f".format(hit.lat)}, ${"%.5f".format(hit.lng)})".replace("|", "/")
        }
}
