package dev.zavz.compatibility;

import org.junit.Test;
import static org.junit.Assert.*;

public class VersionMetadataTest {
    @Test
    public void readsVersionIdFromLauncherJson() {
        String json = "{" + "\"id\"" + ":" + "\"1.7.10\"" + "}";
        assertEquals("1.7.10", VersionMetadata.readVersionId(json));
        assertTrue(VersionMetadata.targetsMinecraft1710(json));
    }

    @Test
    public void rejectsOtherOrMissingVersionMetadata() {
        String otherVersion = "{" + "\"id\"" + ":" + "\"1.8.9\"" + "}";
        String missingVersion = "{" + "\"time\"" + ":" + "\"now\"" + "}";
        assertFalse(VersionMetadata.targetsMinecraft1710(otherVersion));
        assertFalse(VersionMetadata.targetsMinecraft1710(missingVersion));
        assertFalse(VersionMetadata.targetsMinecraft1710(null));
    }
}
