import { HTMLElement, parse } from 'node-html-parser';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const forwardedRequest = new Request(request);
    forwardedRequest.headers.set('accept', 'application/javascript');

    // make subrequests with the global `fetch()` function
    let res = await fetch(
      'https://www.goodreads.com/review/list/63515611-kyle?order=d&amp;page=1&amp;shelf=read&amp;sort=date_read&page=1',
      forwardedRequest
    );

    const body = await res.text();

    const { html, status } = parseJsonP(body);
    const table = `<table>${html}</table>`;

    return new Response(JSON.stringify(getBooksFromHtml(table, 100)));
  },
};

const parseJsonP = (jsonp: string): { html: string; status: any } => {
  const [html, status] = jsonp.split('\n');

  // eslint-disable-next-line quotes
  const json = html.replace('Element.insert("booksBody", ', '').replace(' });', '}').replace('bottom', '"bottom"');
  const output: string = JSON.parse(json).bottom;

  const matches = status.match(/(?<end>\d*) of (?<total>\d*) loaded/);
  return {
    html: output,
    status: {
      end: parseInt(matches?.groups?.end ?? '0'),
      total: parseInt(matches?.groups?.total ?? '0'),
    },
  };
};

export const getBooksFromHtml = (html: string, width: string | number | undefined = 150): any[] => {
  const goodreadsDocument = parse(html);

  const bookElements = goodreadsDocument.querySelectorAll('tr');
  const bookArray = Array.from(bookElements);
  // Get width if not a number
  let newWidth: number;
  if (typeof width !== 'number') {
    newWidth = parseInt(width) || 100;
  } else {
    newWidth = width;
  }
  return bookArray.map((el) => bookMapper(el, newWidth));
};

const bookMapper = (row: HTMLElement, thumbnailWidth: number): any => {
  const isbn = row?.querySelector('td.field.isbn .value')?.textContent?.trim();
  const asin = row?.querySelector('td.field.asin .value')?.textContent?.trim();
  let title = row?.querySelector('td.field.title a')?.getAttribute('title') ?? '';
  const author = row?.querySelector('td.field.author .value')?.textContent?.trim().replace(' *', '').split(', ').reverse().join(' ');
  const imageUrl = row
    ?.querySelector('td.field.cover img')
    ?.getAttribute('src')
    // Get a thumbnail of the requested width
    // Add some padding factor for higher-quality rendering
    ?.replace(/\._(S[Y|X]\d+_?){1,2}_/i, `._SX${thumbnailWidth * 2}_`);
  const href = row?.querySelector('td.field.cover a')?.getAttribute('href');
  const rating = row?.querySelectorAll('td.field.rating .staticStars .p10')?.length;

  const dateReadString = row?.querySelector('td.field.date_read .date_read_value')?.textContent;
  const dateAddedString = row?.querySelector('td.field.date_added span')?.textContent;
  const dateRead = dateReadString ? new Date(dateReadString) : undefined;
  const dateAdded = dateAddedString ? new Date(dateAddedString) : undefined;

  let subtitle = '';
  const splitTitle = title.split(':');
  if (splitTitle.length > 1) {
    title = splitTitle[0];
    subtitle = splitTitle[1];
  }

  const parens = title.match(/\(.*\)/);
  if (parens) {
    const [match] = parens;
    subtitle = match.replace('(', '').replace(')', '');
    title = title.replace(match, '');
  }

  return {
    id: `${isbn || asin || crypto.randomUUID()}`,
    isbn,
    asin,
    title,
    subtitle,
    author,
    imageUrl,
    rating,
    dateRead,
    dateAdded,
    link: `https://www.goodreads.com/${href}`,
  };
};

//
