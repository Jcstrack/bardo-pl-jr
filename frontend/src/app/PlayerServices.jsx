import DiscordBotOption from '../features/discord/components/DiscordBotOption.jsx';
import LibraryShareOption from '../features/library/components/LibraryShareOption.jsx';

export default function PlayerServices({ discordStream, editorKey, accessRole, maximized }) {
  return (
    <>
      <DiscordBotOption stream={discordStream} maximized={maximized} />
      <LibraryShareOption editorKey={editorKey} accessRole={accessRole} maximized={maximized} />
    </>
  );
}
