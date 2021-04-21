/* eslint-disable-next-line  import/prefer-default-export */
function fetchJson(url, token, method, body) {
  const options = { method };
  if (token) {
    options.headers = { Authorization: `Bearer ${token}` };
  }
  if (body) {
    options.body = body;
  }

  return fetch(url, options).then(
    (res) => {
      if (res.ok) {
        return res.json();
      }
      const err = `${options.method} ${url} failed: ${res.statusText}`;
      throw new Error(err);
    },
  );
}

function getBodyAnnotationUrl(projectUrl, dataset, cmd) {
  let url = `${projectUrl}/json-annotations/${dataset.key}/neurons`;
  if (cmd) {
    url += `/${cmd}`;
  }
  if (dataset.tag) {
    url += `?version=${dataset.tag}`;
  }
  return url;
}

export function queryBodyAnnotations(projectUrl, token, dataset, query) {
  const url = getBodyAnnotationUrl(projectUrl, dataset, 'query');
  const body = JSON.stringify(query);
  return fetchJson(url, token, 'POST', body);
}

export function getBodyAnnotation(projectUrl, token, dataset, bodyid) {
  const url = getBodyAnnotationUrl(projectUrl, dataset, `id-number/${bodyid}`);
  return fetchJson(url, token, 'GET').catch(() => (null));
}

export async function updateBodyAnnotation(
  projectUrl, token, dataset, annotation, processNewAnnotation,
) {
  if (annotation && annotation.bodyid) {
    const upload = (a) => {
      const processed = { ...a };
      Object.keys(alert).forEach((key) => {
        if (key.startsWith('_')) {
          delete processed[key];
        }
      });

      return fetchJson(getBodyAnnotationUrl(projectUrl, dataset), token, 'POST', JSON.stringify(processed));
    };

    const data = await getBodyAnnotation(projectUrl, token, dataset, annotation.bodyid);
    let newAnnotation = annotation;
    if (data && data.bodyid) {
      newAnnotation = { ...data, ...annotation };
    }

    return upload(newAnnotation).then(processNewAnnotation(newAnnotation));
  }

  return Promise.reject(new Error('The input annotation is invalid'));
}