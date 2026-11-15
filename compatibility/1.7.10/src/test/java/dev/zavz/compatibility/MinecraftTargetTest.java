package dev.zavz.compatibility;

import org.junit.Test;
import static org.junit.Assert.*;

public class MinecraftTargetTest {
    @Test
    public void acceptsExactTargetVersion() {
        assertTrue(MinecraftTarget.isSupportedVersion("1.7.10"));
    }

    @Test
    public void trimsWhitespace() {
        assertTrue(MinecraftTarget.isSupportedVersion("  1.7.10  "));
    }

    @Test
    public void rejectsOtherVersions() {
        assertFalse(MinecraftTarget.isSupportedVersion("1.8.9"));
        assertFalse(MinecraftTarget.isSupportedVersion("1.7.2"));
        assertFalse(MinecraftTarget.isSupportedVersion(null));
    }
}
