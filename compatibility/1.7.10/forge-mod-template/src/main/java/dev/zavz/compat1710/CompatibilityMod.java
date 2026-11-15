package dev.zavz.compat1710;

import cpw.mods.fml.common.Mod;
import cpw.mods.fml.common.event.FMLInitializationEvent;
import cpw.mods.fml.common.event.FMLPreInitializationEvent;
import cpw.mods.fml.common.event.FMLPostInitializationEvent;
import cpw.mods.fml.common.event.FMLServerStartingEvent;
import dev.zavz.compat1710.feature.DiagnosticsFeature;
import dev.zavz.compat1710.feature.FeatureRegistry;
import org.apache.logging.log4j.Logger;

/**
 * Minimal, standalone Forge 1.7.10 mod entry point.
 * This project is intended for a Forge development environment only.
 */
@Mod(
    modid = CompatibilityMod.MOD_ID,
    name = CompatibilityMod.NAME,
    version = CompatibilityMod.VERSION,
    acceptedMinecraftVersions = "[1.7.10]"
)
public final class CompatibilityMod {
    public static final String MOD_ID = "zavzcompat";
    public static final String NAME = "ZAVZ Compatibility Mod";
    public static final String VERSION = "1.0.0";

    private static Logger logger;
    private static final FeatureRegistry FEATURES = new FeatureRegistry();

    public static FeatureRegistry getFeatures() {
        return FEATURES;
    }

    @Mod.EventHandler
    public void preInit(FMLPreInitializationEvent event) {
        logger = event.getModLog();
        FEATURES.register(new DiagnosticsFeature());
        logger.info("{} pre-initializing for Minecraft 1.7.10", NAME);
        logger.info("{} registered {} passive feature(s)", NAME, FEATURES.size());
    }

    @Mod.EventHandler
    public void init(FMLInitializationEvent event) {
        logger.info("{} initialized in a normal Forge environment", NAME);
    }

    @Mod.EventHandler
    public void postInit(FMLPostInitializationEvent event) {
        logger.info("{} post-initialized", NAME);
    }

    @Mod.EventHandler
    public void serverStarting(FMLServerStartingEvent event) {
        event.registerServerCommand(new CompatibilityCommand());
        logger.info("{} registered the /zavzcompat diagnostic command", NAME);
    }
}
