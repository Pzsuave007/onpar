// Backward-compat alias: TournamentFeed is now a thin wrapper around PhotoFeed.
import PhotoFeed from './PhotoFeed';

export default function TournamentFeed({ tournamentId, canPost = false }) {
  return <PhotoFeed scopeType="tournament" scopeId={tournamentId} canPost={canPost} />;
}
