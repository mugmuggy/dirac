/**
 * Claude Code style chat message component
 * Renders messages with:
 * - ❯ for user messages
 * - ⏺ for assistant messages and tool calls
 * - ⎿ for tool results (indented)
 */

import { DiracMessage, DiracMessageType } from "@shared/ExtensionMessage"
import { Box, Text } from "ink"
import Spinner from "ink-spinner"
import React from "react"
import { Markdown } from "./modular-ui/Markdown"
import { styles } from "../constants/theme"
import { useTerminalSize } from "../hooks/useTerminalSize"
import { ModularCard } from "./modular-ui/ModularCard"
import { clipTextToLastVisualLines, summarizeFirstLine } from "../utils/text-clipping"


/**
 * Add "(Tab)" hint after "Act mode" mentions in plain text.
 * Case-insensitive, avoids double-adding if already present.
 */

interface ChatMessageProps {
    message: DiracMessage
    isStreaming?: boolean
    isExecuting?: boolean
    mode?: "act" | "plan"
    isExpanded?: boolean
    onCollapse?: () => void
    activeVoiceStreamId?: string
    showReasoning?: boolean
    compact?: boolean
    maxContentLines?: number
}

/**
 * Two-column layout for messages with a dot prefix.
 * Keeps content from wrapping under the dot.
 *
 * For this to work properly, parent containers must have width="100%"
 * so flexGrow={1} on the content box has a reference width to fill.
 */
const DotRow: React.FC<{ children: React.ReactNode; color?: string; flashing?: boolean; prefix?: string }> = ({
    children,
    color,
    flashing = false,
    prefix = "⏺",
}) => (
    <Box flexDirection="row">
        <Box width={2}>
            {flashing ? (
                <Text color={color}>
                    <Spinner type="toggle8" />
                </Text>
            ) : (
                <Text color={color}>{prefix}</Text>
            )}
        </Box>
        <Box flexGrow={1}>{children}</Box>
    </Box>
)

function getReasoningParagraphs(content: string, isStreaming: boolean): string[] {
    const normalized = content.replace(/\r\n/g, "\n")
    const chunks = normalized.split(/\n\s*\n+/)
    const hasOpenParagraph = !/\n\s*\n\s*$/.test(normalized)
    const visibleChunks = isStreaming && hasOpenParagraph ? chunks.slice(0, -1) : chunks

    return visibleChunks.map((chunk) => chunk.trim()).filter(Boolean)
}

const ReasoningMessage: React.FC<{
    content: string
    isStreaming: boolean
    showReasoning: boolean
    compact?: boolean
    maxContentLines?: number
    columns: number
}> = ({
    content,
    isStreaming,
    showReasoning,
    compact = false,
    maxContentLines,
    columns,
}) => {
        if (!showReasoning) {
            return null
        }

        if (compact) {
            return (
                <Text>
                    <Text color="gray">⎿ </Text>
                    <Text color={styles.conversation.reasoning.color}>Thinking</Text>
                    <Text color="gray" dimColor>{summarizeFirstLine(content) ? ` · ${summarizeFirstLine(content)}` : ""}</Text>
                </Text>
            )
        }

        const visibleContent = maxContentLines
            ? clipTextToLastVisualLines(content, maxContentLines, Math.max(1, columns - 4))
            : content
        const paragraphs = getReasoningParagraphs(visibleContent, isStreaming)

        return (
            <React.Fragment>
                <DotRow color={styles.conversation.reasoning.color} prefix="◇">
                    <Box flexDirection="column">
                        <Text {...styles.conversation.reasoningTitle}>Thinking</Text>
                        {paragraphs.map((paragraph, index) => (
                            <React.Fragment key={index}>
                                {index > 0 && <Text>{"\n"}</Text>}
                                <Markdown color={styles.conversation.reasoning.color}>{paragraph}</Markdown>
                            </React.Fragment>
                        ))}
                    </Box>
                </DotRow>
                <Text>{"\n"}</Text>
            </React.Fragment>
        )
    }



export const ChatMessage: React.FC<ChatMessageProps> = ({
    message,
    isStreaming: isStreamingProp,
    activeVoiceStreamId,
    isExpanded,
    showReasoning = true,
    compact = false,
    maxContentLines,
    onCollapse,
    mode,
}) => {
    const { columns } = useTerminalSize()
    const isStreaming = isStreamingProp || (message.id === activeVoiceStreamId)
    // --- New Protocol Dispatcher ---
    if ("content" in message) {
        switch (message.content.type) {
            case "markdown":
                if (message.content.isReasoning) {
                    return (
                        <ReasoningMessage
                            columns={columns}
                            compact={compact}
                            content={message.content.content}
                            isStreaming={isStreaming}
                            maxContentLines={maxContentLines}
                            showReasoning={showReasoning}
                        />
                    )
                }
                if (compact) {
                    return (
                        <Text>
                            <Text color="gray">⎿ </Text>
                            <Text color={message.content.role === "user" ? "green" : undefined}>{message.content.role === "user" ? "User" : "Assistant"}</Text>
                            <Text color="gray" dimColor>{summarizeFirstLine(message.content.content) ? ` · ${summarizeFirstLine(message.content.content)}` : ""}</Text>
                        </Text>
                    )
                }
                const markdownContent = maxContentLines
                    ? clipTextToLastVisualLines(message.content.content, maxContentLines, Math.max(1, columns - 4))
                    : message.content.content
                return (
                    <React.Fragment>
                        <DotRow color={message.content.role === "user" ? "green" : undefined} prefix={message.content.role === "user" ? "❯" : undefined}>
                            <Markdown color={mode === "plan" ? styles.conversation.planModeTint.color : undefined}>{markdownContent}</Markdown>
                        </DotRow>
                        <Text>{"\n"}</Text>
                    </React.Fragment>
                )
            case "card":
                return (
                    <ModularCard
                        card={message.content.card}
                        isCompact={compact}
                        isExpanded={isExpanded}
                        isStreaming={isStreaming}
                        maxBodyLines={maxContentLines}
                        onCollapse={onCollapse}
                    />
                )
            case "api_status":
                // API status is summarized in the status bar in CLI
                return null
            default:
                return (
                    <Box borderStyle="single" borderColor="red" paddingX={1}>
                        <Text color="red">Protocol Error: Unknown primitive type "{(message.content as any).type}"</Text>
                    </Box>
                )
        }
    }

    // If we reach here, it means the message doesn't have the 'content' field,
    // which should be impossible according to the new DiracMessage type.
    return (
        <Box borderStyle="single" borderColor="red" paddingX={1}>
            <Text color="red">Protocol Error: Message is missing "content" field.</Text>
        </Box>
    )
}

/**
 * Information
 * Render a list of messages in Claude Code style
 */
interface ChatMessageListProps {
    messages: DiracMessage[]
    maxMessages?: number
    activeVoiceStreamId?: string
    mode?: "act" | "plan"
    showReasoning?: boolean
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, maxMessages, activeVoiceStreamId, mode, showReasoning = true }) => {
    // Filter out messages we don't want to display
    const displayMessages = messages.filter((m) => {
        // Skip api_status if it's just a marker (though in CLI we usually skip it anyway)
        if (m.content.type === DiracMessageType.API_STATUS) return false
        return true
    })

    const { columns } = useTerminalSize()
    // Optionally limit number of messages shown
    const messagesToShow = maxMessages ? displayMessages.slice(-maxMessages) : displayMessages

    // Check if last message is streaming
    const lastMessage = messagesToShow[messagesToShow.length - 1]
    const isLastStreaming = lastMessage && lastMessage.id === activeVoiceStreamId

    return (
        <React.Fragment>
            {messagesToShow.map((msg, idx) => (
                <React.Fragment key={msg.id || msg.ts}>
                    {idx > 0 && messagesToShow[idx - 1].content.type !== msg.content.type && (
                        <Box key={`sep-${idx}`}>
                            <Text {...styles.conversation.typeChangeSep}>{"─".repeat(Math.min(40, columns - 4))}</Text>
                        </Box>
                    )}
                    {idx > 0 && messagesToShow[idx - 1].content.type === msg.content.type && msg.content.type === DiracMessageType.MARKDOWN && (
                        <Box key={`sep-md-${idx}`}>
                            <Text {...styles.conversation.divider}>{"── · ── · ──".repeat(3)}</Text>
                        </Box>
                    )}
                    <ChatMessage
                        isStreaming={idx === messagesToShow.length - 1 && isLastStreaming}
                        activeVoiceStreamId={activeVoiceStreamId}
                        message={msg}
                        mode={mode}
                        showReasoning={showReasoning}
                    />
                </React.Fragment>
            ))}
        </React.Fragment>
    )
}
