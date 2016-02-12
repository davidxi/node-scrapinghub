import Promise from 'bluebird';

import APIError, { Logger, } from './APIError';
import RequestProxyMixin from './RequestProxyMixin';

const MAX_RETRIES = 5;
const RETRY_INTERVAL = 60;


export default class Job extends RequestProxyMixin {

  constructor(project, id, info) {
    super(project, id, info);

    this.project = project;
    this._id = id;
    this.info = info;
    this.MAX_RETRIES = MAX_RETRIES;
    this.RETRY_INTERVAL = RETRY_INTERVAL;
  }

  id() {
    return this._id;
  }

  toString() {
    return `Job(${this.project}, ${this.id()})`;
  }

  async items(offset = 0, count, meta) {
    let params = { offset, };
    let lastexc = undefined;
    let retrieved;
    let result = [];

    if (meta !== undefined) {
      params['meta'] = meta;
    }
    if (count !== undefined) {
      params['count'] = count;
    }

    let attempt = 0;
    for (; attempt < this.MAX_RETRIES; attempt++) {

      retrieved = 0;
      try {

        // let genItems = await this._get('items', 'jl', params);

        let url = `https://storage.scrapinghub.com/items/${this._id}`;
        let params2 = {
          apikey: this.project.connection.apikey,
          start: `${this._id}/${params['offset']}`,
          format: 'jl',
        };
        let genItems = await this._get(url, 'jl', params2);

        for (let item of genItems()) {
          result.push(item);
          retrieved += 1;
        }
        break;

      } catch (exc) {
        lastexc = exc;
        params['offset'] += retrieved;
        if ('count' in params) {
          params['count'] -= retrieved;
        }

        Logger.debug(`
          Retrying read of items.jl in ${this.RETRY_INTERVAL}s:
            job=${this._id}
            offset=${params['offset']}
            count=${params['count']}
            attempt=${attempt}/${this.MAX_RETRIES}
            error=${exc}
            stack=${exc.stack}
        `);

        await Promise.delay(this.RETRY_INTERVAL);
      }
    }

    if (attempt < this.MAX_RETRIES) {
      return Promise.resolve( result );

    } else {
      Logger.error(`
        Failed ${this.MAX_RETRIES} times reading items from ${this._id}, last error was: ${lastexc}
      `);
    }
  }

  update(modifiers) {
    // XXX: only allow add_tag/remove_tag
    return Promise.resolve(
      this._post('jobs_update', 'json', modifiers)
        .then(result => result['count'])
    );
  }

  stop() {
    return Promise.resolve(
      this._post('jobs_stop', 'json')
        .then(result => result['status'] === 'ok')
    );
  }

  delete() {
    return Promise.resolve(
      this._post('jobs_delete', 'json')
        .then(result => result['count'])
    );
  }

  add_report(key, content, content_type = 'text/plain') {
    let params = {
      'project': this.project.id,
      'job': thiss.id,
      'key': key,
      'content_type': content_type,
    };
    let files = {
      // 'content': ('report', StringIO(content))
    };
    return Promise.resolve(
      this._post('reports_add', 'json', params, files)
    );
  }

  log(params) {
    return Promise.resolve(
      this._get('log', 'jl', params)
    );
  }


  _request_proxy() {
    return this.project._request_proxy();
  }

  _add_params(params) {
    params = Object.assign({}, this.project._add_params(), params);
    params['job'] = this.id();
    return params;
  }
}