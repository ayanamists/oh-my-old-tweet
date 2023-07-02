export default function Empty({ username }: { username: string }) {
  return (<div className="text-black dark:text-white 
    flex justify-center flex-col h-screen ml-3">
    <p className="mb-3 text-xl">Oops ... There're no tweets to display.</p>

    <p className="mb-1 text-left">You may:</p>
    <ol className="max-w-md space-y-1 list-decimal list-inside">
      <li>Check your username. Maybe username is wrong.</li>
      <li><span>Search on </span>
        <a target="_blank" href="https://google.com" rel="noreferrer">
          Google
        </a>
        <span> with </span> 
        <code>site:twitter.com { '@' + username }</code>.
        Sometimes Google cache is useful.</li>
    </ol>
  </div>);
}