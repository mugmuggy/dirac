import { DiracMessage } from "@shared/ExtensionMessage"
import { useChatTimeline } from "./useChatTimeline"

export function useChatMessages(messages: DiracMessage[], activeVoiceStreamId?: string, isApiRequestActive?: boolean, taskStatus?: string) {
    const timeline = useChatTimeline({
        messages,
        activeVoiceStreamId,
        isApiRequestActive,
        taskStatus,
        showHeader: false,
        dynamicRows: 8,
    })

    return {
        displayMessages: timeline.displayMessages,
        committedMessages: timeline.staticItems.filter((item) => item.type === "message").map((item) => item.message),
        liveMessages: timeline.dynamicItems.map((item) => item.message),
        taskSwitchKey: timeline.taskSwitchKey,
        setTaskSwitchKey: timeline.setTaskSwitchKey,
    }
}
