package dev.zavz.compatibility;

import org.junit.Test;

import static org.junit.Assert.*;

public class VersionMetadataTest {
    @Test
    public void readsTopLevelVersionIdFromLauncherJson() {
        String json = "{\"id\":\"1.7.10\",\"time\":\"now\"}";
        assertEquals("1.7.10", VersionMetadata.readVersionId(json));
        assertTrue(VersionMetadata.targetsMinecraft1710(json));
    }

    @Test
    public void trimsWhitespaceAroundVersionId() {
        assertEquals("1.7.10", VersionMetadata.readVersionId("{\"id\":\" 1.7.10 \"}"));
        assertTrue(VersionMetadata.targetsMinecraft1710("{\"id\":\" 1.7.10 \"}"));
    }

    @Test
    public void ignoresNestedIdWhenTopLevelIdIsMissing() {
        String json = "{\"downloads\":{\"client\":{\"id\":\"1.7.10\"}}}";
        assertEquals("", VersionMetadata.readVersionId(json));
        assertFalse(VersionMetadata.targetsMinecraft1710(json));
    }

    @Test
    public void rejectsOtherMissingAndNonStringIds() {
        assertFalse(VersionMetadata.targetsMinecraft1710("{\"id\":\"1.8.9\"}"));
        assertFalse(VersionMetadata.targetsMinecraft1710("{\"time\":\"now\"}"));
        assertFalse(VersionMetadata.targetsMinecraft1710("{\"id\":1710}"));
        assertFalse(VersionMetadata.targetsMinecraft1710(null));
        assertFalse(VersionMetadata.targetsMinecraft1710(""));
        assertFalse(VersionMetadata.targetsMinecraft1710("   "));
    }

    @Test
    public void rejectsMalformedJsonAndNonObjectRoots() {
        assertEquals("", VersionMetadata.readVersionId("{\"id\":"));
        assertEquals("", VersionMetadata.readVersionId("[{\"id\":\"1.7.10\"}]"));
        assertEquals("", VersionMetadata.readVersionId("\"1.7.10\""));
        assertFalse(VersionMetadata.targetsMinecraft1710("{\"id\":"));
    }

    @Test
    public void classifiesKnownSupportedUnsupportedAndUnknownVersions() {
        assertEquals(VersionCompatibility.SUPPORTED,
                VersionMetadata.classifyMinecraftVersion("{\"id\":\"1.7.10\"}"));
        assertEquals(VersionCompatibility.UNSUPPORTED,
                VersionMetadata.classifyMinecraftVersion("{\"id\":\"1.8.9\"}"));
        assertEquals(VersionCompatibility.UNKNOWN,
                VersionMetadata.classifyMinecraftVersion("{\"time\":\"now\"}"));
        assertEquals(VersionCompatibility.UNKNOWN,
                VersionMetadata.classifyMinecraftVersion("{\"id\":1710}"));
        assertEquals(VersionCompatibility.UNKNOWN,
                VersionMetadata.classifyMinecraftVersion("not-json"));
    }

    @Test
    public void treatsNullBooleanAndBlankIdsAsUnknown() {
        assertEquals(VersionCompatibility.UNKNOWN,
                VersionMetadata.classifyMinecraftVersion("{\"id\":null}"));
        assertEquals(VersionCompatibility.UNKNOWN,
                VersionMetadata.classifyMinecraftVersion("{\"id\":true}"));
        assertEquals(VersionCompatibility.UNKNOWN,
                VersionMetadata.classifyMinecraftVersion("{\"id\":\"   \"}"));
    }
}