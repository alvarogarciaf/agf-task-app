fetch('https://share.gemini.google/GqJkiRyH8P00', {headers: {'User-Agent': 'Mozilla/5.0'}})
  .then(r => r.text())
  .then(t => {
    const titleMatch = t.match(/<title[^>]*>([^<]+)<\/title>/i);
    console.log("Title tag:", titleMatch ? titleMatch[1] : 'no title');
    const ogMatch = t.match(/og:title[^>]*content="([^"]+)"/i) || t.match(/content="([^"]+)"[^>]*og:title/i);
    console.log("OG Title:", ogMatch ? ogMatch[1] : 'no og');
    
    // Check if the title is actually in the HTML somewhere else
    console.log("Length of HTML:", t.length);
    if (t.includes("Link formatting test")) {
        console.log("Found conversation title in HTML!");
    } else {
        console.log("Conversation title NOT found in raw HTML.");
    }
  });
