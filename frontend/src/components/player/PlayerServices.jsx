import DiscordBotOption from './DiscordBotOption.jsx';
import LibraryShareOption from './LibraryShareOption.jsx';

export default function PlayerServices({ discordStream, editorKey, accessRole, maximized }) {
  return (
    <>
      <DiscordBotOption stream={discordStream} maximized={maximized} />
      <LibraryShareOption editorKey={editorKey} accessRole={accessRole} maximized={maximized} />
    </>
  );
}
