use lol_html::{element, HtmlRewriter, Settings};
use serde::{Deserialize, Serialize};
use worker::*;

#[derive(Serialize, Deserialize, Debug)]
struct Jsonp {
    bottom: String,
}

#[event(fetch)]
async fn main(req: Request, env: Env, ctx: Context) -> Result<Response> {
    let url = "https://www.goodreads.com/review/list/63515611-kyle?order=d&amp;page=1&amp;shelf=read&amp;sort=date_read&page=1";

    let client = reqwest::Client::new();

    let response = client
        .get(url)
        .header(reqwest::header::ACCEPT, "application/javascript")
        .send()
        .await
        .expect("Could not fetch data")
        .text()
        .await
        .expect("Could not get text from response");

    /*
    let mut output = vec![];

    let mut rewriter = HtmlRewriter::new(
        Settings {
            element_content_handlers: vec![element!("a[href]", |el| {
                let href = el
                    .get_attribute("href")
                    .expect("href was required")
                    .replace("http:", "https:");

                el.set_attribute("href", &href)?;

                Ok(())
            })],
            ..Settings::default()
        },
        |c: &[u8]| output.extend_from_slice(c),
    );

    rewriter.write(response);
    */

    let mut split = response.split("\n");

    let html = split
        .next()
        .expect(("Could not retrieve HTML"))
        .replace("Element.insert(\"booksBody\", ", "")
        .replace(" });", "}")
        .replace("bottom", "\"bottom\"");

    let parsed: Jsonp = serde_json::from_str(&html).expect("JSON was not well-formatted");

    let status = split.next();

    return Response::ok(parsed.bottom);
}
