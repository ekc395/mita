import Image from 'next/image';
import Link from 'next/link';

import { animeTitle, type ActivityType } from '@/lib/types';

interface FeedProfile {
  username: string | null;
  display_name: string | null;
}

/** One activity row joined to its actor, its target user and its title. */
export interface FeedActivity {
  id: string;
  type: ActivityType;
  anilist_id: number | null;
  score: number | null;
  created_at: string;
  actor: FeedProfile | null;
  target: FeedProfile | null;
  anime: {
    title_english: string | null;
    title_romaji: string | null;
    cover_image_url: string | null;
  } | null;
}

function displayName(profile: FeedProfile | null): string {
  return profile?.display_name ?? (profile?.username ? `@${profile.username}` : 'Someone');
}

/**
 * Coarse relative time. Rendered on the server, so it is the age as of the
 * request rather than a live-ticking clock -- accurate enough for a feed, and
 * it keeps this a Server Component.
 */
function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

function ActorLink({ profile }: { profile: FeedProfile | null }) {
  const name = displayName(profile);
  if (!profile?.username) return <span className="font-medium">{name}</span>;

  return (
    <Link href={`/u/${profile.username}`} className="font-medium hover:underline">
      {name}
    </Link>
  );
}

export function FeedItem({ activity }: { activity: FeedActivity }) {
  const title = activity.anime ? animeTitle(activity.anime) : null;

  const titleLink =
    title && activity.anilist_id !== null ? (
      <Link href={`/anime/${activity.anilist_id}`} className="font-medium hover:underline">
        {title}
      </Link>
    ) : (
      <span className="font-medium">{title ?? 'something'}</span>
    );

  return (
    <li className="flex items-center gap-3 py-3">
      {activity.anime?.cover_image_url ? (
        <Image
          src={activity.anime.cover_image_url}
          alt=""
          width={40}
          height={56}
          className="h-14 w-10 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="h-14 w-10 shrink-0 rounded bg-neutral-200 dark:bg-neutral-800" />
      )}

      <p className="min-w-0 flex-1 text-sm leading-relaxed">
        <ActorLink profile={activity.actor} />{' '}
        {activity.type === 'ranked' && <>ranked {titleLink}</>}
        {activity.type === 'want' && <>wants to watch {titleLink}</>}
        {activity.type === 'followed' && (
          <>
            followed <ActorLink profile={activity.target} />
          </>
        )}
        {activity.type === 'recommended' && (
          <>
            recommended {titleLink} to <ActorLink profile={activity.target} />
          </>
        )}
        <span className="ml-1 text-neutral-400">· {timeAgo(activity.created_at)}</span>
      </p>

      {activity.score !== null && (
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {activity.score.toFixed(1)}
        </span>
      )}
    </li>
  );
}
