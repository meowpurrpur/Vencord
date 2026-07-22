/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import { ApplicationStreamingStore, FluxDispatcher, RelationshipStore, UserStore, VoiceStateStore } from "@webpack/common";

const settings = definePluginSettings({
    friendsOnly: {
        type: OptionType.BOOLEAN,
        description: "Only start watching the screen of people you are friends with",
        default: true
    },
    maxStreams: {
        type: OptionType.SLIDER,
        description: "The maximum amount of streams to watch",
        markers: makeRange(1, 10, 1),
        stickToMarkers: true,
        default: 5
    }
});

interface VoiceStateChangeEvent {
    userId: string;
    channelId?: string;
    guildId?: string;
    oldChannelId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    sessionId: string;
}

export default definePlugin({
    name: "AutoWatchScreenshares",
    description: "Automatically watches screenshares when joining a voice channel or a screenshare starts",
    authors: [Devs.theo],
    settings,

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceStateChangeEvent[]; }) {
            const currentUser = UserStore.getCurrentUser();
            const currentVoice = VoiceStateStore.getVoiceStateForUser(currentUser.id);

            console.log(currentVoice);
            for (const state of voiceStates) {
                if (!state.channelId || state.channelId !== currentVoice?.channelId) continue;
                if (state.userId === currentUser.id) continue;

                const activeStreams = ApplicationStreamingStore.getAllActiveStreamsForChannel(state.channelId);
                const streams = ApplicationStreamingStore.getAllApplicationStreamsForChannel(state.channelId);

                let watchedCount = 0;
                for (const stream of streams) {
                    // check if tthe stream is already being watched
                    if (activeStreams.some(s => s.ownerId === stream.ownerId)) {
                        watchedCount++;
                        continue;
                    }

                    if (watchedCount >= settings.store.maxStreams) break;
                    if (settings.store.friendsOnly && !RelationshipStore.isFriend(stream.ownerId)) continue;

                    FluxDispatcher.dispatch({
                        type: "STREAM_WATCH",
                        streamKey: stream.streamType === "guild" ?
                            `guild:${state.guildId}:${state.channelId}:${stream.ownerId}` :
                            `call:${state.channelId}:${stream.ownerId}`,
                        allowMultiple: true
                    });

                    watchedCount++;
                }
            }
        }
    }
});
