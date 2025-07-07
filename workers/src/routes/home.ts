export function handleHome(): Response {
  const html = "<html><body><div>This is a Cutty App (lol)</div></body></html>";
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}