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
    }

    @Test
    public void rejectsMalformedJson() {
        assertEquals("", VersionMetadata.readVersionId("{\"id\":"));
        assertFalse(VersionMetadata.targetsMinecraft1710("{\"id\":"));
    }
}
