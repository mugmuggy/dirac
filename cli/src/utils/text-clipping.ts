const DEFAULT_COLUMNS = 80

export function estimateVisualLineCount(text: string, columns = DEFAULT_COLUMNS): number {
    const width = Math.max(1, columns)
    const lines = text.split("\n")
    return lines.reduce((total, line) => total + Math.max(1, Math.ceil(line.length / width)), 0)
}

export function clipTextToLastVisualLines(
    text: string,
    maxLines: number,
    columns = DEFAULT_COLUMNS,
    marker = "… earlier output clipped …",
): string {
    const lineBudget = Math.max(1, maxLines)
    const width = Math.max(1, columns)
    const lines = text.split("\n")
    const kept: string[] = []
    let usedLines = 0
    let clipped = false

    for (let index = lines.length - 1; index >= 0; index--) {
        const line = lines[index]
        const visualLines = Math.max(1, Math.ceil(line.length / width))
        if (usedLines + visualLines <= lineBudget) {
            kept.unshift(line)
            usedLines += visualLines
            continue
        }

        const remainingLines = lineBudget - usedLines
        if (remainingLines > 0) {
            kept.unshift(line.slice(-remainingLines * width))
            usedLines = lineBudget
        }
        clipped = true
        break
    }

    const result = kept.join("\n")
    if (!clipped && lines.length === kept.length) {
        return result
    }

    return `${marker}\n${result}`
}

export function summarizeFirstLine(text: string, maxLength = 100): string {
    const line = text
        .split("\n")
        .map((part) => part.trim())
        .find(Boolean)

    if (!line) return ""

    const plain = line
        .replace(/^#{1,6}\s+/, "")
        .replace(/[*_`~]+/g, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/^>\s+/, "")

    if (plain.length <= maxLength) return plain
    return `${plain.slice(0, maxLength - 1)}…`
}
