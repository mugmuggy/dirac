import { RenderType } from "@shared/ExtensionMessage"
import React from "react"
import { Text } from "ink"
import { Diff } from "./Diff"
import { linkifyPaths } from "../../utils/terminal-link"
import { clipTextToLastVisualLines } from "../../utils/text-clipping"
import { Markdown } from "./Markdown"

interface CardBodyProps {
    body?: string
    maxLines?: number
    renderType: RenderType
}

export const CardBody: React.FC<CardBodyProps> = ({ body, maxLines, renderType }) => {
    if (!body) return null
    const visibleBody = maxLines ? clipTextToLastVisualLines(body, maxLines, Math.max(1, (process.stdout.columns || 80) - 6)) : body
    return <React.Fragment>{renderContent(visibleBody, renderType)}</React.Fragment>
}

function renderContent(body: string, renderType: RenderType): React.ReactNode {
    switch (renderType) {
        case "markdown":
            return <Markdown>{body}</Markdown>
        case "diff":
            return <Diff content={body} />
        case "text":
        default:
            return <Text>{linkifyPaths(body)}</Text>
    }
}
