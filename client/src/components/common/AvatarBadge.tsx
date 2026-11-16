import type { Avatar } from '@shared';

export default function AvatarBadge({ avatar, size = 40 }: { avatar: Avatar; size?: number }) {
  return (
    <span className="avatar" style={{ background: avatar.color, width: size, height: size, fontSize: size * 0.58 }}>
      {avatar.face}
    </span>
  );
}
