import fetch from 'node-fetch';
import FormData from 'form-data';
import invariant from 'invariant';
import Promise from 'bluebird';
import urljoin from 'url-join';
import urlencode from 'urlencode';

import APIError, { Logger, } from './APIError';
import Project from './Project';

export const __version__ = '1.7.0';


export default class Connection {

  constructor(apikey=process.env.SH_APIKEY, password, _old_passwd, url=DEFAULT_ENDPOINT) {

    invariant(apikey, 'No API key provided and SH_APIKEY environment variable not set');

    invariant(!/^http/i.test(apikey), 'Instantiating scrapinghub.Connection with url as first argument is not supported');

    invariant(!password, 'Authentication with user:pass is not supported, use your apikey instead');

    this.apikey = apikey;
    this.url = url;
    this._session = this._create_session()
  }

  _create_session() {

    if (!/@/.test(this.url)) {
      this.url = this.url.replace(/:\/\//, `://${this.apikey}@`);
    }

    const opts = {
      headers: {
        'User-Agent': `python-scrapinghub/${__version__}`,
      },
    };

    return {
      get: (url, headers) => {
        headers = Object.assign({}, opts.headers, headers);
        return fetch(url, {
            method: 'GET',
            headers: headers,
          });
      },
      post: (url, headers, data, files) => {
        invariant(!files, '@TODO');

        let formData = new FormData();
        for (let key in data) {
          formData.append(key, data[key]);
        }

        headers = Object.assign({}, opts.headers, headers);
        return fetch(url, {
            method: 'POST',
            headers: headers,
            body: formData,
          });
      },
    };
  }

  /**
   * Returns full url for given method and format
   */
  _build_url(method, format) {

    if (!Object.prototype.hasOwnProperty.call(API_METHODS, method)) {
      throw APIError({title: `Unknown method : ${method}`});
    }

    const base_path = API_METHODS[method];
    const path = `${base_path}.${format}`;

    return urljoin(this.url, path);
  }

  /**
   * Performs GET request
   */
  _get(method, format, params, headers, raw) {

    let url = /^http/i.test(method)
                ? method
                : this._build_url(method, format);

    if (params) {
      if (typeof params === 'string') {
        url = `${url}?${params}`;
      } else if (typeof params === 'object' && !Array.isArray(params)) {
        let query = urlencode.stringify(params, {charset: 'utf-8'});
        url = `${url}?${query}`;
      } else {
        invariant(false, 'unsupported params format %s', params);
      }
    }

    return this._request(url, undefined, headers, format, raw);
  }

  /**
   * Performs POST request
   */
  _post(method, format, params, headers, raw, files) {
    const url = this._build_url(method, format);
    return this._request(url, params, headers, format, raw, files);
  }


  /**
   * Performs the request using and returns the content deserialized,
   *   based on given `format`.
   *   Available formats:
   *     * json - Returns a json object and checks for errors
   *     * jl   - Returns a generator of json object per item
   * Raises APIError if json response have error status.
   */

  _request(url, data, headers, format, raw, files) {

    if (['json', 'jl'].indexOf(format) < 0 && !raw) {
      return Promise.reject(
        APIError({title:"format must be either json or jl"})
      );
    }

    if (!data && !files) {
      return Promise.resolve(
        this._session.get(url, headers)
          .then(response => this._decode_response(response, format, raw))
      );
    } else {
      return Promise.resolve(
        this._session.post(url, headers, data, files)
          .then(response => this._decode_response(response, format, raw))
      );
    }

  }


  _decode_response(response, format, raw) {
    if (raw) {

      return Promise.resolve(
        response.text()
          .then(body => body)
      );

    } else if (format === 'json') {

      return Promise.resolve(
        response.json()
          .then(data => {

            if (!'status' in data) {
              return Promise.reject(
                APIError({title: "JSON response does not contain status"})
              );
            }

            if (data['status'] === 'ok') {
              return data;

            } else if (['error', 'badrequest'].indexOf(data['status'])) {
              return Promise.reject(
                APIError({title: data['message']})
              );

            } else {
              return Promise.reject(
                APIError({title: `Unknown response status: ${data['status']}`})
              );
            }
          })
      );

    } else if (format === 'jl') {

      return Promise.resolve(
        response.text()
          .then(text => {
            return function* () {
              let lines = text.split(/\r|\n/g);
              for (let line of lines) {
                if (!line.length) {
                  continue;
                }
                //let _line = decodeURIComponent(escape(line));
                let _line = line;
                yield JSON.parse(_line);
              }
            };
          })
      );

    }
  }

  /**
   * Returns `Project` instance for given key.
   * Does not verify if project exists.
   */

  project(key) {
    return Promise.resolve(
      new Project(this, key)
    );
  }

  /**
   * Returns a list of projects available for this connection and
   * crendentials
   */
  project_ids() {
    return Promise.resolve(
      this._get('listprojects', 'json')
        .then(json => json['projects'])
    );
  }

}

export const DEFAULT_ENDPOINT = 'https://dash.scrapinghub.com/api/';

export const API_METHODS = {
  'addversion': 'scrapyd/addversion',
  'listprojects': 'scrapyd/listprojects',
  'jobs_count': 'jobs/count',
  'jobs_list': 'jobs/list',
  'jobs_update': 'jobs/update',
  'jobs_stop': 'jobs/stop',
  'jobs_delete': 'jobs/delete',
  'eggs_add': 'eggs/add',
  'eggs_delete': 'eggs/delete',
  'eggs_list': 'eggs/list',
  'as_project_slybot': 'as/project-slybot',
  'as_spider_properties': 'as/spider-properties',
  'schedule': 'schedule',
  'items': 'items',
  'log': 'log',
  'spiders': 'spiders/list',
  'reports_add': 'reports/add',
};