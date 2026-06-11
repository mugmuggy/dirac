import { useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { combineCardSequences } from "@shared/combineCardSequences"
import { DiracMessageType, isFinalStatus } from "@shared/ExtensionMessage"
import type { DiracMessage } from "@shared/ExtensionMessage"
import { useTurnCommit } from "./useTurnCommit"

const LIVE_MESSAGE_BODY_LINE_LIMIT = 8
const EXPANDED_INTERACTIVE_CARD_RESERVED_LINES = 2

export type TimelineMessageKind = "card" | "markdown" | "reasoning" | "checkpoint"

export interface TimelineMessageItem {
    key: string
    type: "message"
    message: DiracMessage
    kind: TimelineMessageKind
    isCompact?: boolean
    maxContentLines?: number
}

export interface TimelineNoticeItem {
    key: string
    type: "notice"
    message: string
}

export interface TimelineHeaderItem {
    key: string
    type: "header"
}

export type TimelineStaticItem = TimelineHeaderItem | TimelineMessageItem
export type TimelineDynamicItem = TimelineMessageItem | TimelineNoticeItem

export interface ChatTimelineResult {
    displayMessages: DiracMessage[]
    staticItems: TimelineStaticItem[]
    dynamicItems: TimelineDynamicItem[]
    taskSwitchKey: number
    setTaskSwitchKey: Dispatch<SetStateAction<number>>
}

interface ChatTimelineOptions {
    messages: DiracMessage[]
    activeVoiceStreamId?: string
    isApiRequestActive?: boolean
    taskStatus?: string
    showHeader: boolean
    dynamicRows: number
}

export function useChatTimeline({
    messages,
    activeVoiceStreamId,
    isApiRequestActive,
    taskStatus,
    showHeader,
    dynamicRows,
}: ChatTimelineOptions): ChatTimelineResult {
    const dynamicRowBudget = Math.max(1, dynamicRows)
    const [taskSwitchKey, setTaskSwitchKey] = useState(0)
    const prevFirstMessageId = useRef<string | null>(null)

    const displayMessages = useMemo(() => prepareTranscriptMessages(messages), [messages])

    const firstMessageId = displayMessages[0]?.id ?? null
    useEffect(() => {
        if (prevFirstMessageId.current !== null && firstMessageId !== null && prevFirstMessageId.current !== firstMessageId) {
            setTaskSwitchKey((key) => key + 1)
        }
        prevFirstMessageId.current = firstMessageId
    }, [firstMessageId])

    const { committed, live } = useTurnCommit(
        displayMessages,
        isApiRequestActive ?? false,
        activeVoiceStreamId,
        taskStatus,
    )

    const staticItems = useMemo(
        () => createStaticTimelineItems(committed, live, showHeader, activeVoiceStreamId),
        [committed, live, showHeader, activeVoiceStreamId],
    )

    const dynamicItems = useMemo(
        () => createDynamicTimelineItems(live, activeVoiceStreamId, dynamicRowBudget),
        [live, activeVoiceStreamId, dynamicRowBudget],
    )

    return {
        displayMessages,
        staticItems,
        dynamicItems,
        taskSwitchKey,
        setTaskSwitchKey,
    }
}

export function prepareTranscriptMessages(messages: DiracMessage[]): DiracMessage[] {
    const transcriptMessages = messages.filter((message) => message.content?.type !== DiracMessageType.API_STATUS)
    return combineCardSequences(transcriptMessages)
}

function createStaticTimelineItems(
    committedMessages: DiracMessage[],
    liveMessages: DiracMessage[],
    showHeader: boolean,
    activeVoiceStreamId?: string,
): TimelineStaticItem[] {
    const items: TimelineStaticItem[] = []

    if (showHeader) {
        items.push({ key: "header", type: "header" })
    }

    for (const message of committedMessages) {
        items.push(createMessageItem(message))
    }

    for (const message of liveMessages) {
        if (canRenderLiveMessageStatically(message, activeVoiceStreamId)) {
            items.push(createMessageItem(message))
        }
    }

    return items
}

function createDynamicTimelineItems(
    liveMessages: DiracMessage[],
    activeVoiceStreamId: string | undefined,
    dynamicRows: number,
): TimelineDynamicItem[] {
    const dynamicMessages = liveMessages.filter((message) => !canRenderLiveMessageStatically(message, activeVoiceStreamId))
    if (dynamicMessages.length === 0) return []

    const latestMessage = dynamicMessages[dynamicMessages.length - 1]
    const activeItemLineBudget = getActiveItemLineBudget(latestMessage, dynamicRows)
    const olderRowBudget = Math.max(0, dynamicRows - activeItemLineBudget)
    const olderMessages = dynamicMessages.slice(0, -1)
    const keptOlderMessages = olderMessages.slice(-olderRowBudget)
    const omittedCount = olderMessages.length - keptOlderMessages.length

    const items: TimelineDynamicItem[] = []
    if (omittedCount > 0) {
        items.push({
            key: "dynamic-omitted",
            type: "notice",
            message: `… ${omittedCount} earlier active update${omittedCount === 1 ? "" : "s"} clipped …`,
        })
    }

    items.push(...keptOlderMessages.map((message) => ({ ...createMessageItem(message), isCompact: true })))
    items.push({ ...createMessageItem(latestMessage), maxContentLines: activeItemLineBudget })
    return items
}

function getActiveItemLineBudget(message: DiracMessage, dynamicRows: number): number {
    const availableBodyLines = Math.max(1, dynamicRows - EXPANDED_INTERACTIVE_CARD_RESERVED_LINES)
    if (isExpandedInteractiveCard(message)) {
        return availableBodyLines
    }

    return Math.min(LIVE_MESSAGE_BODY_LINE_LIMIT, availableBodyLines)
}

function isExpandedInteractiveCard(message: DiracMessage): boolean {
    if (message.content.type !== DiracMessageType.CARD) return false

    const { card } = message.content
    return card.collapsed === false || card.requireApproval === true || card.requireFeedback === true
}

function canRenderLiveMessageStatically(message: DiracMessage, activeVoiceStreamId?: string): boolean {
    if (message.id === activeVoiceStreamId) {
        return false
    }
    if (message.content.type === DiracMessageType.MARKDOWN) {
        return true
    }

    if (message.content.type !== DiracMessageType.CARD) {
        return false
    }

    return isFinalStatus(message.content.card.status)
}

function createMessageItem(message: DiracMessage): TimelineMessageItem {
    return {
        key: message.id,
        type: "message",
        message,
        kind: getMessageKind(message),
    }
}

function getMessageKind(message: DiracMessage): TimelineMessageKind {
    if (message.content.type === DiracMessageType.MARKDOWN) {
        return message.content.isReasoning ? "reasoning" : "markdown"
    }

    if (message.content.type === DiracMessageType.CARD) {
        return "card"
    }

    return "checkpoint"
}
