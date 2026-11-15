package dev.zavz.compat1710.feature;

/**
 * Passive example feature proving that registry entries can be queried.
 */
public final class DiagnosticsFeature implements Feature {
    @Override
    public String getId() {
        return "diagnostics";
    }

    @Override
    public String getDescription() {
        return "Reports that the standalone Forge feature registry is available.";
    }
}
