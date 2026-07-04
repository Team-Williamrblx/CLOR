import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/utils/database';
import { withSessionRoute } from '@/lib/withSession';

type Data = {
  success: boolean;
  error?: string;
  notifications?: any[];
  unreadCount?: number;
};

export default withSessionRoute(handler);

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (!req.session.userid) {
    return res.status(401).json({ success: false, error: 'Not logged in' });
  }

  const workspaceGroupId = BigInt(req.query.id as string);
  const userId = req.session.userid;

  if (req.method === 'POST') {
    const { type, title, body, href } = req.body as {
      type?: string;
      title?: string;
      body?: string;
      href?: string;
    };

    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'title and body are required' });
    }

    const notifType = type ?? 'changelog';

    await prisma.notification.create({
      data: {
        userId,
        workspaceGroupId,
        type: notifType,
        title,
        body,
        href: href ?? null,
      },
    });

    return res.status(201).json({ success: true });
  }

  if (req.method === 'GET') {
    const notifications = await prisma.notification.findMany({
      where: { userId, workspaceGroupId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return res.status(200).json({
      success: true,
      notifications: notifications.map((n) => ({
        ...n,
        id: n.id,
        userId: n.userId.toString(),
        workspaceGroupId: n.workspaceGroupId.toString(),
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  }

  if (req.method === 'PATCH') {
    const { ids } = req.body as { ids?: string[] };

    if (ids && ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId, workspaceGroupId },
        data: { read: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId, workspaceGroupId, read: false },
        data: { read: true },
      });
    }

    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { ids } = req.body as { ids?: string[] };

    if (ids && ids.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: ids }, userId, workspaceGroupId },
      });
    } else {
      await prisma.notification.deleteMany({
        where: { userId, workspaceGroupId },
      });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
