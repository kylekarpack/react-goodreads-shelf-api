import { Text, Element } from '@cloudflare/workers-types';
import { Book } from './types/book';
import { Status } from './types/status';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const forwardedRequest = new Request(request);
    forwardedRequest.headers.set('accept', 'application/javascript');

    const url = new URL(request.url);

    // make subrequests with the global `fetch()` function
    const urlToFetch = `https://www.goodreads.com/review/list/${url.pathname.replace('users/', '')}${url.search}`;
    let res = await fetch(urlToFetch, forwardedRequest);

    // Simulate success if we get a 204 No Content response
    if (res.status === 204) {
      return new Response(
        JSON.stringify({
          books: [],
          status: {
            end: Number(url.searchParams.get('page')) * 30,
            total: 0,
          },
        })
      );
    }

    const body = await res.text();
    const { html, status } = parseJsonP(body);

    const table = `<table>${html}</table>`;

    const data: Book[] = await stream(table);
    status.start = status.end! - data.length;
    status.pageSize = data.length;

    return new Response(
      JSON.stringify({
        data,
        status,
      })
    );
  },
};

const stream = async (table: string): Promise<Book[]> => {
  const data: any[] = [];

  let curIndex = 0;

  const getText = (key: keyof Book) => {
    return {
      text(element: Text) {
        data[curIndex][key] = data[curIndex][key] ?? '';
        data[curIndex][key] += element.text.trim();
      },
    };
  };

  const getAttribute = (key: keyof Book, attribute?: string) => {
    attribute = attribute ?? key;
    return {
      element(element: Element) {
        data[curIndex][key] = element.getAttribute(attribute!);
      },
    };
  };

  return new Promise((resolve, reject) => {
    new HTMLRewriter()
      .on('table', {
        element(element) {
          element.onEndTag(() => {
            resolve(data.map(bookCleaner));
          });
        },
      })
      .on('tr.review', {
        element(element) {
          data[curIndex] = {
            rating: 0,
          };
          element.onEndTag(() => {
            curIndex++;
          });
        },
      })
      .on('td.field.isbn .value', getText('isbn'))
      .on('td.field.asin .value', getText('asin'))
      .on('td.field.title a', getAttribute('title'))
      .on('td.field.author .value', getText('author'))
      .on('td.field.cover img', getAttribute('imageUrl', 'src'))
      .on('td.field.date_read .date_read_value', getText('dateRead'))
      .on('td.field.date_added span', getText('dateAdded'))
      .on('td.field.rating .staticStars .p10', {
        element() {
          data[curIndex].rating++;
        },
      })

      .transform(new Response(table));
  });
};

const parseJsonP = (jsonp: string): { html: string; status: Partial<Status> } => {
  const [html, status] = jsonp.split('\n');

  const json = html.replace('Element.insert("booksBody", ', '').replace(' });', '}').replace('bottom', '"bottom"');
  let output = JSON.parse(json).bottom;

  const matches = status.match(/(?<end>\d*) of (?<total>\d*) loaded/);
  return {
    html: output,
    status: {
      end: parseInt(matches?.groups?.end ?? '0'),
      total: parseInt(matches?.groups?.total ?? '0'),
    },
  };
};

const bookCleaner = (rawBook: any, thumbnailWidth: number): any => {
  rawBook.author = rawBook.author?.replace('*', '').split(', ').reverse().join(' ');
  rawBook.imageUrl = rawBook.imageUrl?.replace(/\._(S[Y|X]\d+_?){1,2}_/i, `._SX${thumbnailWidth * 2}_`);

  rawBook.dateRead = rawBook.dateRead ? new Date(rawBook.dateRead) : undefined;
  rawBook.dateAdded = rawBook.dateAdded ? new Date(rawBook.dateAdded) : undefined;

  const splitTitle = rawBook.title.split(':');
  if (splitTitle.length > 1) {
    rawBook.title = splitTitle[0];
    rawBook.subtitle = splitTitle[1]?.trim();
  }

  const parens = rawBook.title.match(/\(.*\)/);
  if (parens) {
    const [match] = parens;
    rawBook.subtitle = match.replace('(', '').replace(')', '')?.trim();
    rawBook.title = rawBook.title.replace(match, '')?.trim();
  }

  return rawBook as Book;
};
