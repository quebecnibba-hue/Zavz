package dev.zavz.compat1710.feature;

import net.minecraftforge.common.config.Configuration;
import net.minecraftforge.common.config.Property;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Deterministic registry for features owned by this Forge mod.
 * Enabled flags are persisted using Forge's normal configuration system.
 */
public final class FeatureRegistry {
    private final Map<String, Feature> features = new LinkedHashMap<String, Feature>();
    private final Map<String, Boolean> enabled = new LinkedHashMap<String, Boolean>();

    public void register(Feature feature) {
        if (feature == null) {
            throw new IllegalArgumentException("feature must not be null");
        }
        String id = feature.getId();
        if (id == null || id.trim().isEmpty()) {
            throw new IllegalArgumentException("feature id must not be blank");
        }
        String key = id.toLowerCase(Locale.ROOT);
        if (features.containsKey(key)) {
            throw new IllegalArgumentException("duplicate feature id: " + id);
        }
        features.put(key, feature);
        enabled.put(key, Boolean.TRUE);
    }

    public void load(Configuration configuration) {
        if (configuration == null) {
            throw new IllegalArgumentException("configuration must not be null");
        }
        for (Map.Entry<String, Feature> entry : features.entrySet()) {
            String id = entry.getKey();
            Property property = configuration.get(
                "features",
                id + ".enabled",
                true,
                "Whether the " + id + " feature is enabled."
            );
            enabled.put(id, Boolean.valueOf(property.getBoolean(true)));
        }
        if (configuration.hasChanged()) {
            configuration.save();
        }
    }

    public boolean isEnabled(String id) {
        if (id == null || !enabled.containsKey(id.toLowerCase(Locale.ROOT))) {
            return false;
        }
        return enabled.get(id.toLowerCase(Locale.ROOT)).booleanValue();
    }

    public void setEnabled(String id, boolean value, Configuration configuration) {
        if (id == null || !features.containsKey(id.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("unknown feature: " + id);
        }
        String key = id.toLowerCase(Locale.ROOT);
        enabled.put(key, Boolean.valueOf(value));
        if (configuration != null) {
            configuration.get("features", key + ".enabled", true).set(value);
            configuration.save();
        }
    }

    public Feature get(String id) {
        if (id == null) {
            return null;
        }
        return features.get(id.toLowerCase(Locale.ROOT));
    }

    public List<Feature> getAll() {
        return Collections.unmodifiableList(
            new ArrayList<Feature>(features.values())
        );
    }

    public int size() {
        return features.size();
    }
}
