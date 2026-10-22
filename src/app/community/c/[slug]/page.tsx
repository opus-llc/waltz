import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getCommunity, feed, communityMembersList, communityEvents, isMember, joinedCommunities } from "@/lib/queries";
import { formatDateTime, nowMs } from "@/lib/format";
import { PostCard } from "@/components/PostCard";
import { Composer } from "@/components/Composer";
import { JoinButton } from "@/components/JoinButton";
import { Tabs } from "@/components/Tabs";
import { Avatar } from "@/components/Avatar";
import { EventForm } from "@/components/EventForm";

export async function generateMetadata({ params }: PageProps<"/community/c/[slug]">): Promise<Metadata> {
  const c = getCommunity((await params).slug);
  return c ? { title: c.name, description: c.description } : {};
}

export default async function CommunityPage({ params, searchParams }: PageProps<"/community/c/[slug]">) {
  const c = getCommunity((await params).slug);
  if (!c) notFound();
  const sp = await searchParams;
  const tab = sp.tab === "events" ? "events" : sp.tab === "members" ? "members" : "topics";
  const user = await getCurrentUser();
  const joined = isMember(c.id, user?.id);
  const members = communityMembersList(c.id, 200);
  const me = members.find((m) => m.id === user?.id);
  const canManage = isAdmin(user) || me?.role === "owner" || me?.role === "moderator";
  const now = nowMs();

  return (
    <div className="space-y-3">
      <div className="overflow-hidden border-line bg-white sm:rounded-2xl sm:border">
        <div className="h-20" style={{ background: `linear-gradient(120deg, ${c.color}, ${c.color}55)` }} />
        <div className="px-4 pb-4">
          <div className="-mt-8 flex items-end justify-between gap-3">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-white text-3xl shadow-sm">{c.icon}</span>
            {user ? <JoinButton slug={c.slug} joined={joined} owner={me?.role === "owner"} /> : <Link href={`/signup?next=/community/c/${c.slug}`} className="btn btn-primary btn-sm">参加する</Link>}
          </div>
          <h1 className="mt-3 text-xl font-bold">{c.name}</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">{c.description}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {members.slice(0, 5).map((m) => (
                <span key={m.id} className="rounded-full ring-2 ring-white"><Avatar name={m.name} color={m.avatarColor} size="xs" /></span>
              ))}
            </div>
            <span className="text-xs text-muted">{members.length}人が参加中</span>
          </div>
        </div>
        <Tabs
          active={tab}
          tabs={[
            { key: "topics", label: "トピック", href: `/community/c/${c.slug}` },
            { key: "events", label: "イベント", href: `/community/c/${c.slug}?tab=events` },
            { key: "members", label: "メンバー", href: `/community/c/${c.slug}?tab=members` },
          ]}
        />
      </div>

      {tab === "topics" && (
        <>
          {joined && user && (
            <div className="border-line bg-white p-4 sm:rounded-2xl sm:border">
              <Composer communities={joinedCommunities(user.id)} defaultCommunityId={c.id} placeholder={`${c.name}に投稿する`} />
            </div>
          )}
          {feed({ communityId: c.id, viewerId: user?.id, limit: 40 }).map((p) => <PostCard key={p.id} post={p} viewer={user} />)}
        </>
      )}

      {tab === "events" && (
        <div className="space-y-3 px-4 sm:px-0">
          {canManage && <EventForm communityId={c.id} />}
          {communityEvents(c.id).map((e) => {
            const past = e.startsAt.getTime() < now;
            return (
              <article key={e.id} className={`rounded-2xl border border-line bg-white p-4 ${past ? "opacity-60" : ""}`}>
                <p className="accent-text text-xs font-bold">{formatDateTime(e.startsAt)}{past && "（終了）"}</p>
                <h2 className="mt-1 font-bold">{e.title}</h2>
                <p className="mt-1 text-xs text-muted">📍 {e.location || "未定"}</p>
                {e.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{e.description}</p>}
                {e.applyUrl && !past && (
                  <a href={e.applyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm mt-3">申し込む</a>
                )}
              </article>
            );
          })}
          {communityEvents(c.id).length === 0 && <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">予定されているイベントはありません。</p>}
        </div>
      )}

      {tab === "members" && (
        <ul className="divide-y divide-line overflow-hidden border-line bg-white sm:rounded-2xl sm:border">
          {members.map((m) => (
            <li key={m.id}>
              <Link href={`/community/u/${m.handle}`} className="flex items-center gap-3 p-4 hover:bg-soft">
                <Avatar name={m.name} color={m.avatarColor} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{m.name}</span>
                  <span className="block truncate text-xs text-muted">{m.headline}</span>
                </span>
                {m.role !== "member" && <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-[11px] text-muted">{m.role === "owner" ? "オーナー" : "モデレーター"}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
