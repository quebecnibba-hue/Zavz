package dev.zavz.compat1710;

import net.minecraft.command.CommandBase;
import net.minecraft.command.ICommandSender;
import net.minecraft.util.ChatComponentText;

/**
 * Harmless server-side command used to verify that the mod loaded.
 */
public final class CompatibilityCommand extends CommandBase {
    @Override
    public String getCommandName() {
        return "zavzcompat";
    }

    @Override
    public String getCommandUsage(ICommandSender sender) {
        return "/zavzcompat";
    }

    @Override
    public void processCommand(ICommandSender sender, String[] args) {
        sender.addChatMessage(new ChatComponentText(
            "ZAVZ Compatibility Mod " + CompatibilityMod.VERSION
                + " is loaded on Minecraft 1.7.10."
        ));
    }
}
