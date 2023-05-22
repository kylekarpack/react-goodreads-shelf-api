use scraper::*;
use worker::*;

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

    let document = Html::parse_document(&response);

    return Response::ok(document.html());
}
