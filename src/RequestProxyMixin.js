import invariant from 'invariant';

export default class RequestProxyMixin {

  _add_params(params) {
    return params;
  }

  _request_proxy() {
    invariant(false, 'override this in subclass');
  }

  _get(method, format, params, headers, raw) {
    params = this._add_params(params || {});
    return this._request_proxy()._get(method, format, params, headers, raw);
  }

  _post(method, format, params, headers, raw, files) {
    params = this._add_params(params || {});
    return this._request_proxy()._post(method, format, params, headers, raw, files);
  }
}