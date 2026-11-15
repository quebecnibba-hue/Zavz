package dev.zavz.compat1710;

import dev.zavz.compat1710.feature.Feature;
import net.minecraft.command.CommandBase;
import net.minecraft.command.ICommandSender;
import net.minecraft.util.ChatComponentText;

/**
 * Harmless server-side command used to verify the mod and list registered features.
 */
public final class CompatibilityCommand extends CommandBase {
    @Override
    public String getCommandName() {
        return "zavzcompat";
    }

    @Override
    public String getCommandUsage(ICommandSender sender) {
        return "/zavzcompat [features]";
    }

    @Override
    public void processCommand(ICommandSender sender, String[] args) {
        sender.addChatMessage(new ChatComponentText(
            "ZAVZ Compatibility Mod " + CompatibilityMod.VERSION
                + " is loaded on Minecraft 1.7.10."
        ));

        if (args.length == 1 && "features".equalsIgnoreCase(args[0])) {
            sender.addChatMessage(new ChatComponentText(
                "Registered passive features: " + CompatibilityMod.getFeatures().size()
            ));
            for (Feature feature : CompatibilityMod.getFeatures().getAll()) {
                sender.addChatMessage(new ChatComponentText(
                    "- " + feature.getId() + ": " + feature.getDescription()
                ));
            }
        }
    }
}
