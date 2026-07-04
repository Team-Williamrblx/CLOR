import type { NextApiRequest, NextApiResponse } from "next"
import prisma from "@/utils/database"
import { withPublicApiRateLimit } from "@/utils/prtl"
import { validateApiKey } from "@/utils/api-auth"

type Data = {
  success: boolean
  error?: string
  sent?: number
}

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  const apiKey = req.headers.authorization?.replace("Bearer ", "")
  if (!apiKey) {
    return res.status(401).json({ success: false, error: "Missing API key" })
  }

  const workspaceId = Number.parseInt(req.query.id as string)
  if (!workspaceId || Number.isNaN(workspaceId)) {
    return res.status(400).json({ success: false, error: "Invalid workspace ID" })
  }

  const key = await validateApiKey(apiKey, workspaceId)
  if (!key) {
    return res.status(401).json({ success: false, error: "Invalid or expired API key" })
  }

  const { title, description, href } = req.body as {
    title?: unknown
    description?: unknown
    href?: unknown
  }

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ success: false, error: "title is required" })
  }
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return res.status(400).json({ success: false, error: "description is required" })
  }
  if (href !== undefined && href !== null && typeof href !== "string") {
    return res.status(400).json({ success: false, error: "href must be a string" })
  }
  if (typeof href === "string" && href.length > 0) {
    try {
      new URL(href)
    } catch {
      return res.status(400).json({ success: false, error: "href must be a valid URL" })
    }
  }

  if (title.trim().length > 100) {
    return res.status(400).json({ success: false, error: "title must be 100 characters or fewer" })
  }
  if (description.trim().length > 500) {
    return res.status(400).json({ success: false, error: "description must be 500 characters or fewer" })
  }

  try {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceGroupId: workspaceId },
      select: { userId: true },
    })

    if (members.length === 0) {
      return res.status(200).json({ success: true, sent: 0 })
    }

    await prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        workspaceGroupId: BigInt(workspaceId),
        type: "custom",
        title: title.trim(),
        body: description.trim(),
        href: typeof href === "string" && href.length > 0 ? href.trim() : null,
      })),
    })

    return res.status(201).json({ success: true, sent: members.length })
  } catch (error) {
    console.error("Error sending notifications:", error)
    return res.status(500).json({ success: false, error: "Internal server error" })
  }
}

export default withPublicApiRateLimit(handler)
