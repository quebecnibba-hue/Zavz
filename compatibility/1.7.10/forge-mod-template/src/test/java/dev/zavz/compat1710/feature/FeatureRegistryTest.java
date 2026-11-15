package dev.zavz.compat1710.feature;

import net.minecraftforge.common.config.Configuration;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.util.List;

import static org.junit.Assert.*;

public class FeatureRegistryTest {
    @Rule
    public TemporaryFolder temporaryFolder = new TemporaryFolder();

    private static final class TestFeature implements Feature {
        private final String id;

        private TestFeature(String id) {
            this.id = id;
        }

        @Override
        public String getId() {
            return id;
        }

        @Override
        public String getDescription() {
            return "Test feature";
        }
    }

    @Test
    public void registerStoresFeatureAndDefaultsToEnabled() {
        FeatureRegistry registry = new FeatureRegistry();
        TestFeature feature = new TestFeature("Diagnostics");

        registry.register(feature);

        assertEquals(1, registry.size());
        assertSame(feature, registry.get("diagnostics"));
        assertTrue(registry.isEnabled("DIAGNOSTICS"));
    }

    @Test
    public void registerRejectsNullBlankAndDuplicateIds() {
        final FeatureRegistry registry = new FeatureRegistry();

        assertIllegalArgument(new Runnable() {
            @Override public void run() { registry.register(null); }
        });
        assertIllegalArgument(new Runnable() {
            @Override public void run() { registry.register(new TestFeature("  ")); }
        });

        registry.register(new TestFeature("Diagnostics"));
        assertIllegalArgument(new Runnable() {
            @Override public void run() { registry.register(new TestFeature("DIAGNOSTICS")); }
        });
        assertEquals(1, registry.size());
    }

    @Test
    public void unknownIdsAreNotEnabledAndGetReturnsNull() {
        FeatureRegistry registry = new FeatureRegistry();

        assertFalse(registry.isEnabled("missing"));
        assertFalse(registry.isEnabled(null));
        assertNull(registry.get("missing"));
        assertNull(registry.get(null));
    }

    @Test
    public void getAllReturnsAnImmutableSnapshot() {
        FeatureRegistry registry = new FeatureRegistry();
        registry.register(new TestFeature("one"));

        List<Feature> features = registry.getAll();
        assertEquals(1, features.size());
        try {
            features.add(new TestFeature("two"));
            fail("Expected immutable list");
        } catch (UnsupportedOperationException expected) {
            // Expected.
        }

        registry.register(new TestFeature("two"));
        assertEquals("The returned list is a snapshot", 1, features.size());
        assertEquals(2, registry.getAll().size());
    }

    @Test
    public void loadReadsAndPersistsConfiguredEnabledState() throws Exception {
        File file = temporaryFolder.newFile("features.cfg");
        Configuration configuration = new Configuration(file);
        configuration.get("features", "diagnostics.enabled", true).set(false);
        configuration.save();

        FeatureRegistry registry = new FeatureRegistry();
        registry.register(new TestFeature("diagnostics"));
        registry.load(new Configuration(file));

        assertFalse(registry.isEnabled("diagnostics"));

        Configuration reloaded = new Configuration(file);
        assertFalse(reloaded.get("features", "diagnostics.enabled", true).getBoolean(true));
    }

    @Test
    public void setEnabledUpdatesStateAndPersistsIt() throws Exception {
        File file = temporaryFolder.newFile("set-enabled.cfg");
        Configuration configuration = new Configuration(file);
        FeatureRegistry registry = new FeatureRegistry();
        registry.register(new TestFeature("diagnostics"));

        registry.setEnabled("DIAGNOSTICS", false, configuration);

        assertFalse(registry.isEnabled("diagnostics"));
        Configuration reloaded = new Configuration(file);
        assertFalse(reloaded.get("features", "diagnostics.enabled", true).getBoolean(true));

        registry.setEnabled("diagnostics", true, configuration);
        assertTrue(registry.isEnabled("diagnostics"));
        Configuration reloadedAgain = new Configuration(file);
        assertTrue(reloadedAgain.get("features", "diagnostics.enabled", false).getBoolean(false));
    }

    @Test
    public void loadAndSetEnabledRejectInvalidArguments() throws Exception {
        final FeatureRegistry registry = new FeatureRegistry();
        assertIllegalArgument(new Runnable() {
            @Override public void run() { registry.load(null); }
        });
        assertIllegalArgument(new Runnable() {
            @Override public void run() { registry.setEnabled("missing", true, null); }
        });
    }

    private static void assertIllegalArgument(Runnable action) {
        try {
            action.run();
            fail("Expected IllegalArgumentException");
        } catch (IllegalArgumentException expected) {
            // Expected.
        }
    }
}
