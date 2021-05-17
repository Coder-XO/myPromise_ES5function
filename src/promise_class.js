/*
自定义promise函数模块  ：IIFE
 */
(function (window) {

    const PENDING = 'pending'
    const RESOLVED = 'resolved'
    const REJECTED = 'rejected'

    class Promise {
        /*
        Promise构造函数
        excutor 执行器函数(同步执行)
        */
        constructor(excutor) {
            // 将当前promise对象保存起来
            const self = this
            self.status = PENDING   // 给promise对象指定status属性,初始值为pending
            self.data = undefined   // 给promise对象指定一个用于存储结果数据的属性
            self.callbacks = []    // 每个元素的结构：{onResolved(){},onRejected(){}}

            function resolve(value) {   // 由外部使用者调用
                // 如果当前状态不是pending 直接返回结束 状态只能改一次
                if (self.status !== PENDING) {
                    return
                }
                // 将作态改为resolved
                self.status = RESOLVED
                // 保存value数据
                self.data = value
                // 如果有待执行的callback函数，立即异步执行回调函数onResolved
                if (self.callbacks.length > 0) {
                    setTimeout(() => { // 放在队列里面执行所有成功的回调
                        self.callbacks.forEach(callbacksObj => {
                            callbacksObj.onResolved(value)   // 执行回调
                        })
                    }, 0)
                }
            }

            function reject(reason) {   // 由外部使用者调用
                // 如果当前状态不是pending 直接返回结束 状态只能改一次
                if (self.status !== PENDING) {
                    return
                }
                // 将作态改为rejected
                self.status = REJECTED
                // 保存value数据
                self.data = reason
                // 如果有待执行的callback函数，立即异步执行回调函数onResolved
                if (self.callbacks.length > 0) {
                    setTimeout(() => { // 放在队列里面执行所有失败的回调
                        self.callbacks.forEach(callbacksObj => {
                            callbacksObj.onRejected(reason)   // 执行回调
                        })
                    }, 0)
                }
            }

            // 立即同步执行excutor
            try {    // 执行器函数如果出现异常,promise对象变为失败状态
                excutor(resolve, reject)
            } catch (error) {
                reject(error)
            }
        }

        /*
        Promise原型对象的then
        指定成功和失败的回调函数
        返回一个新的promise对象
        返回的promise的结果由onResolved/onRejected执行结果决定的
        * */
        then(onResolved, onRejected) {
            // 指定默认的成功回调
            onResolved = typeof onResolved === 'function' ? onResolved : value => value // 向后传递成功的value
            // 指定默认的失败回调，实现错误/异常的传透
            onRejected = typeof onRejected === 'function' ? onRejected : reason => {  // 向后传递失败的reason
                throw reason
            }

            // 将当前promise对象保存起来
            const self = this

            //返回一个新的promise对象
            return new Promise((resolve, reject) => {
                /*
                * 调用指定回调函数处理，根据执行结果，改变 return 的promise的状态
                * */
                function handle(callback) {    // 回调结果处理函数 以及promise状态的改变
                    /*
                     1. 如果抛出异常,return的promise就会失败
                     2. 如果回调函数返回的不是promise，return的promise就会成功,value就是返回的值
                     3. 如果回调函数返回得是promise,return的promise执行结果就是这个promise的结果
                     * */
                    try {
                        const result = callback(self.data)   // 回调执行的结果
                        if (result instanceof Promise) {   // 如果回调函数执行的结果是promise,return的新的promise执行结果就是这个promise的结果
                            result.then(
                                // value => resolve(value),   // 当result成功时，return的promise也成功
                                // reason => reject(reason)   // 当result失败时，return的promise也失败
                                resolve, reject   // 上面的简便写法
                            )
                        } else {
                            resolve(result)
                        }
                    } catch (error) {
                        // 如果抛出异常，return的promise就会失败，reason就是结果
                        reject(error)
                    }
                }

                // 根据上一个promise的状态来决定新的promise执行哪个回调
                //当前状态为pending状态,将回调保存起来
                if (self.status === PENDING) {
                    self.callbacks.push({    // 保存回调函数
                        onResolved(value) {
                            handle(onResolved)
                        },
                        onRejected(reason) {
                            handle(onRejected)
                        }
                    })
                } else if (self.status === RESOLVED) {   // 当前是resolved状态，异步执行onResolved并改变return的promise的状态
                    setTimeout(() => {
                        handle(onResolved)   // 见上面函数
                    })
                } else {     // 当前是rejected状态，异步执行onRejected并改变return的promise
                    setTimeout(() => {
                        handle(onRejected)
                    })
                }
            })
        }

        /*
        Promise原型对象的catch
        指定失败的回调函数
        返回一个新的promise对象
        *  */
        catch(onRejected) {
            return this.then(undefined, onRejected)
        }

        /*
        Promise函数对象resolve
        返回一个指定结果的成功的promise
        * */
        static resolve(value) {
            // 返回一个成功/失败的promise
            return new Promise((resolve, reject) => {
                // value 是 promise
                if (value instanceof Promise) { // 使用value的结果作为promise的结果
                    value.then(resolve, reject)
                } else {   // value不是promise => promise变为成功，数据是value
                    resolve(value)
                }
            })
        }

        /*
        Promise函数对象reject
        返回一个指定reason的失败的promise
        **/
        static reject(reason) {
            // 返回一个失败的promise
            return new Promise((resolve, reject) => {
                reject(reason)
            })
        }

        /*
        Promise函数对象all
        返回一个promise，只有当所有promise都成功时才成功，否则只要有一个失败的就失败
        * */
        static all(promises) {
            // 用来保存所有成功的value的数组
            const values = new Array(promises.length)
            // 用来保存成功的promise的数量
            let resolvedCount = 0
            // 返回一个新的promise
            return new Promise((resolve, reject) => {
                // 遍历promises获取每一个promise的结果
                promises.forEach((p, index) => {
                    Promise.resolve(p).then(    // 非promise对象也包装成promise对象
                        value => {
                            resolvedCount++     // 成功的数量加一
                            // p成功，将成功的value保存values
                            values[index] = value    // 保证数组值的顺序问题
                            //如果全部成功，将return的promise改变成功
                            if (resolvedCount === promises.length) {
                                resolve(values)
                            }
                        }, reason => {  // 只要一个失败了，return的promise就失败
                            reject(reason)
                        }
                    )
                })
            })
        }

        /*
        Promise函数对象race
        返回一个promise，其结果由第一个完成的promise决定
        * */
        static race(promises) {
            //  返回一个promise
            return new Promise((resolve, reject) => {
                // 遍历promises获取每个promise的结果
                promises.forEach((p) => {
                    Promise.resolve(p).then(
                        value => {    // 一旦有成功的，将返回的promise变为成功
                            resolve(value)
                        }, reason => {  // 只要一个失败了，return的promise就失败
                            reject(reason)
                        }
                    )
                })
            })
        }

        /*
        * 自定义的函数，返回一个promise对象，它在指定的时间后才确定结果
        * */
        static resolveDelay(value, time) {
            // 返回一个成功/失败的promise
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (value instanceof Promise) {// 使用value的结果作为promise结果
                        value.then(resolve, reject)
                    } else {   // value不是promise => promise变为成功，数据是value
                        resolve(value)
                    }
                }, time)
            })
        }

        /*
        * 自定义的函数，返回一个promise对象，它在指定的时间后才失败
        * */
        static rejectDelay(reason, time) {
            // 返回一个成功/失败的promise
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    reject(reason)
                }, time)
            })
        }

        // 向外暴露Promise函数
    }

    window.Promise = Promise
})(window)
