use worker::*;

#[event(fetch)]
async fn main(req: Request, env: Env, ctx: Context) -> Result<Response> {
    let url = "https://www.goodreads.com/review/list/63515611-kyle?order=d&amp;page=1&amp;shelf=read&amp;sort=date_read";
    let response = reqwest::get(url).await.unwrap().text().await.unwrap();

    return Response::ok(response);
}
