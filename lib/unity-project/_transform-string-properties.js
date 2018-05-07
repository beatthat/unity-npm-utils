const _transformStringProperties = (o, transform) => {
  return Object.keys(o).reduce((curObj, curPropName) => {
    const curPropVal = o[curPropName]

    if(typeof(curPropVal) === 'object') {
      curObj[curPropName] = _transformStringProperties(curPropVal, transform)
    }
    else {
      curObj[curPropName] = (typeof(curPropVal) === 'string')?
        transform(curPropVal): curPropVal
    }

    return curObj
  },
  {})
}

module.exports = _transformStringProperties
