package dev.zavz.compatibility;

import org.junit.Test;
import static org.junit.Assert.*;

public class VersionMetadataTest {
    @Test
    public void readsVersionIdFromLauncherJson() {
        assertEquals("1.7.10", VersionMetadata.readVersionId(
            "{\\"id\\": \\"1.7.10\\", \\"time\\": \\"2014-09-02T00:00:00+00:00\\"}"
        ));
    }

    @Test
    public void rejectsOtherOrMissingVersionMetadata() {
        assertFalse(VersionMetadata.targetsMinecraft1710("{\\"id\\": \\"1.8.9\\"}"));
        assertFalse(VersionMetadata.targetsMinecraft1710("{\\"time\\": \\"now\\"}"));
        assertFalse(VersionMetadata.targetsMinecraft1710(null));
    }
}
