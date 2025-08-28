/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/_app";
exports.ids = ["pages/_app"];
exports.modules = {

/***/ "./components/UserContext.js":
/*!***********************************!*\
  !*** ./components/UserContext.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   UserProvider: () => (/* binding */ UserProvider),\n/* harmony export */   useUser: () => (/* binding */ useUser)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ \"react\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);\n// components/UserContext.js\n\n\nconst UserContext = /*#__PURE__*/ (0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(null);\nconst UserProvider = ({ children })=>{\n    const [user, setUser] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);\n    const login = (userData)=>{\n        setUser(userData);\n    };\n    const logout = ()=>{\n        setUser(null);\n    };\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(UserContext.Provider, {\n        value: {\n            user,\n            login,\n            logout\n        },\n        children: children\n    }, void 0, false, {\n        fileName: \"C:\\\\Users\\\\telot\\\\Downloads\\\\versiones_sistema\\\\sistema15\\\\components\\\\UserContext.js\",\n        lineNumber: 18,\n        columnNumber: 5\n    }, undefined);\n};\nconst useUser = ()=>{\n    return (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(UserContext);\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9jb21wb25lbnRzL1VzZXJDb250ZXh0LmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLDRCQUE0Qjs7QUFDZ0M7QUFFNUQsTUFBTUcsNEJBQWNILG9EQUFhQSxDQUFDO0FBRTNCLE1BQU1JLGVBQWUsQ0FBQyxFQUFFQyxRQUFRLEVBQUU7SUFDdkMsTUFBTSxDQUFDQyxNQUFNQyxRQUFRLEdBQUdOLCtDQUFRQSxDQUFDO0lBRWpDLE1BQU1PLFFBQVEsQ0FBQ0M7UUFDYkYsUUFBUUU7SUFDVjtJQUVBLE1BQU1DLFNBQVM7UUFDYkgsUUFBUTtJQUNWO0lBRUEscUJBQ0UsOERBQUNKLFlBQVlRLFFBQVE7UUFBQ0MsT0FBTztZQUFFTjtZQUFNRTtZQUFPRTtRQUFPO2tCQUNoREw7Ozs7OztBQUdQLEVBQUU7QUFFSyxNQUFNUSxVQUFVO0lBQ3JCLE9BQU9YLGlEQUFVQSxDQUFDQztBQUNwQixFQUFFIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vc2lzdGVtYS1nZXN0aW9uLWludmVudGFyaW8vLi9jb21wb25lbnRzL1VzZXJDb250ZXh0LmpzP2M3M2UiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gY29tcG9uZW50cy9Vc2VyQ29udGV4dC5qc1xyXG5pbXBvcnQgeyBjcmVhdGVDb250ZXh0LCB1c2VTdGF0ZSwgdXNlQ29udGV4dCB9IGZyb20gJ3JlYWN0JztcclxuXHJcbmNvbnN0IFVzZXJDb250ZXh0ID0gY3JlYXRlQ29udGV4dChudWxsKTtcclxuXHJcbmV4cG9ydCBjb25zdCBVc2VyUHJvdmlkZXIgPSAoeyBjaGlsZHJlbiB9KSA9PiB7XHJcbiAgY29uc3QgW3VzZXIsIHNldFVzZXJdID0gdXNlU3RhdGUobnVsbCk7XHJcblxyXG4gIGNvbnN0IGxvZ2luID0gKHVzZXJEYXRhKSA9PiB7XHJcbiAgICBzZXRVc2VyKHVzZXJEYXRhKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBsb2dvdXQgPSAoKSA9PiB7XHJcbiAgICBzZXRVc2VyKG51bGwpO1xyXG4gIH07XHJcblxyXG4gIHJldHVybiAoXHJcbiAgICA8VXNlckNvbnRleHQuUHJvdmlkZXIgdmFsdWU9e3sgdXNlciwgbG9naW4sIGxvZ291dCB9fT5cclxuICAgICAge2NoaWxkcmVufVxyXG4gICAgPC9Vc2VyQ29udGV4dC5Qcm92aWRlcj5cclxuICApO1xyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IHVzZVVzZXIgPSAoKSA9PiB7XHJcbiAgcmV0dXJuIHVzZUNvbnRleHQoVXNlckNvbnRleHQpO1xyXG59O1xyXG4iXSwibmFtZXMiOlsiY3JlYXRlQ29udGV4dCIsInVzZVN0YXRlIiwidXNlQ29udGV4dCIsIlVzZXJDb250ZXh0IiwiVXNlclByb3ZpZGVyIiwiY2hpbGRyZW4iLCJ1c2VyIiwic2V0VXNlciIsImxvZ2luIiwidXNlckRhdGEiLCJsb2dvdXQiLCJQcm92aWRlciIsInZhbHVlIiwidXNlVXNlciJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./components/UserContext.js\n");

/***/ }),

/***/ "./components/UserSelector.js":
/*!************************************!*\
  !*** ./components/UserSelector.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ UserSelector)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _UserContext__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./UserContext */ \"./components/UserContext.js\");\n/* harmony import */ var next_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/router */ \"./node_modules/next/router.js\");\n/* harmony import */ var next_router__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_router__WEBPACK_IMPORTED_MODULE_2__);\n// components/UserSelector.js\n\n\n\nconst users = {\n    user1: {\n        id: \"user1\",\n        name: \"Usuario 1 (Chile)\",\n        role: \"chile\"\n    },\n    user2: {\n        id: \"user2\",\n        name: \"Usuario 2 (China)\",\n        role: \"china\"\n    },\n    user3: {\n        id: \"user3\",\n        name: \"Usuario 3 (Admin)\",\n        role: \"admin\"\n    }\n};\nfunction UserSelector() {\n    const { user, login, logout } = (0,_UserContext__WEBPACK_IMPORTED_MODULE_1__.useUser)();\n    const router = (0,next_router__WEBPACK_IMPORTED_MODULE_2__.useRouter)();\n    const handleLogin = (userId)=>{\n        login(users[userId]);\n        if (router.pathname === \"/\") {\n            router.push(\"/dashboard\");\n        }\n    };\n    const handleLogout = ()=>{\n        logout();\n        router.push(\"/\");\n    };\n    if (router.pathname === \"/\") {\n        return null; // No mostrar en la página de login\n    }\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n        className: \"bg-gray-800 text-white p-2 text-sm flex justify-center items-center gap-4\",\n        children: [\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"span\", {\n                children: [\n                    \"Usuario actual: \",\n                    /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"strong\", {\n                        children: user ? user.name : \"Ninguno\"\n                    }, void 0, false, {\n                        fileName: \"C:\\\\Users\\\\telot\\\\Downloads\\\\versiones_sistema\\\\sistema15\\\\components\\\\UserSelector.js\",\n                        lineNumber: 33,\n                        columnNumber: 29\n                    }, this)\n                ]\n            }, void 0, true, {\n                fileName: \"C:\\\\Users\\\\telot\\\\Downloads\\\\versiones_sistema\\\\sistema15\\\\components\\\\UserSelector.js\",\n                lineNumber: 33,\n                columnNumber: 7\n            }, this),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"div\", {\n                className: \"flex gap-2\",\n                children: [\n                    Object.keys(users).map((userId)=>/*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"button\", {\n                            onClick: ()=>handleLogin(userId),\n                            disabled: user?.id === userId,\n                            className: \"px-2 py-1 bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-xs\",\n                            children: users[userId].name\n                        }, userId, false, {\n                            fileName: \"C:\\\\Users\\\\telot\\\\Downloads\\\\versiones_sistema\\\\sistema15\\\\components\\\\UserSelector.js\",\n                            lineNumber: 36,\n                            columnNumber: 11\n                        }, this)),\n                    user && /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"button\", {\n                        onClick: handleLogout,\n                        className: \"px-2 py-1 bg-red-600 rounded-md hover:bg-red-700 text-xs\",\n                        children: \"Cerrar Sesi\\xf3n\"\n                    }, void 0, false, {\n                        fileName: \"C:\\\\Users\\\\telot\\\\Downloads\\\\versiones_sistema\\\\sistema15\\\\components\\\\UserSelector.js\",\n                        lineNumber: 46,\n                        columnNumber: 11\n                    }, this)\n                ]\n            }, void 0, true, {\n                fileName: \"C:\\\\Users\\\\telot\\\\Downloads\\\\versiones_sistema\\\\sistema15\\\\components\\\\UserSelector.js\",\n                lineNumber: 34,\n                columnNumber: 7\n            }, this)\n        ]\n    }, void 0, true, {\n        fileName: \"C:\\\\Users\\\\telot\\\\Downloads\\\\versiones_sistema\\\\sistema15\\\\components\\\\UserSelector.js\",\n        lineNumber: 32,\n        columnNumber: 5\n    }, this);\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9jb21wb25lbnRzL1VzZXJTZWxlY3Rvci5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSw2QkFBNkI7O0FBQ1c7QUFDQTtBQUV4QyxNQUFNRSxRQUFRO0lBQ1pDLE9BQU87UUFBRUMsSUFBSTtRQUFTQyxNQUFNO1FBQXFCQyxNQUFNO0lBQVE7SUFDL0RDLE9BQU87UUFBRUgsSUFBSTtRQUFTQyxNQUFNO1FBQXFCQyxNQUFNO0lBQVE7SUFDL0RFLE9BQU87UUFBRUosSUFBSTtRQUFTQyxNQUFNO1FBQXFCQyxNQUFNO0lBQVE7QUFDakU7QUFFZSxTQUFTRztJQUN0QixNQUFNLEVBQUVDLElBQUksRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEVBQUUsR0FBR1oscURBQU9BO0lBQ3ZDLE1BQU1hLFNBQVNaLHNEQUFTQTtJQUV4QixNQUFNYSxjQUFjLENBQUNDO1FBQ25CSixNQUFNVCxLQUFLLENBQUNhLE9BQU87UUFDbkIsSUFBSUYsT0FBT0csUUFBUSxLQUFLLEtBQUs7WUFDM0JILE9BQU9JLElBQUksQ0FBQztRQUNkO0lBQ0Y7SUFFQSxNQUFNQyxlQUFlO1FBQ25CTjtRQUNBQyxPQUFPSSxJQUFJLENBQUM7SUFDZDtJQUVBLElBQUlKLE9BQU9HLFFBQVEsS0FBSyxLQUFLO1FBQzNCLE9BQU8sTUFBTSxtQ0FBbUM7SUFDbEQ7SUFFQSxxQkFDRSw4REFBQ0c7UUFBSUMsV0FBVTs7MEJBQ2IsOERBQUNDOztvQkFBSztrQ0FBZ0IsOERBQUNDO2tDQUFRWixPQUFPQSxLQUFLTCxJQUFJLEdBQUc7Ozs7Ozs7Ozs7OzswQkFDbEQsOERBQUNjO2dCQUFJQyxXQUFVOztvQkFDWkcsT0FBT0MsSUFBSSxDQUFDdEIsT0FBT3VCLEdBQUcsQ0FBQ1YsQ0FBQUEsdUJBQ3RCLDhEQUFDVzs0QkFFQ0MsU0FBUyxJQUFNYixZQUFZQzs0QkFDM0JhLFVBQVVsQixNQUFNTixPQUFPVzs0QkFDdkJLLFdBQVU7c0NBRVRsQixLQUFLLENBQUNhLE9BQU8sQ0FBQ1YsSUFBSTsyQkFMZFU7Ozs7O29CQVFSTCxzQkFDQyw4REFBQ2dCO3dCQUFPQyxTQUFTVDt3QkFBY0UsV0FBVTtrQ0FBMkQ7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQU85RyIsInNvdXJjZXMiOlsid2VicGFjazovL3Npc3RlbWEtZ2VzdGlvbi1pbnZlbnRhcmlvLy4vY29tcG9uZW50cy9Vc2VyU2VsZWN0b3IuanM/ZjgyMiJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBjb21wb25lbnRzL1VzZXJTZWxlY3Rvci5qc1xyXG5pbXBvcnQgeyB1c2VVc2VyIH0gZnJvbSAnLi9Vc2VyQ29udGV4dCc7XHJcbmltcG9ydCB7IHVzZVJvdXRlciB9IGZyb20gJ25leHQvcm91dGVyJztcclxuXHJcbmNvbnN0IHVzZXJzID0ge1xyXG4gIHVzZXIxOiB7IGlkOiAndXNlcjEnLCBuYW1lOiAnVXN1YXJpbyAxIChDaGlsZSknLCByb2xlOiAnY2hpbGUnIH0sXHJcbiAgdXNlcjI6IHsgaWQ6ICd1c2VyMicsIG5hbWU6ICdVc3VhcmlvIDIgKENoaW5hKScsIHJvbGU6ICdjaGluYScgfSxcclxuICB1c2VyMzogeyBpZDogJ3VzZXIzJywgbmFtZTogJ1VzdWFyaW8gMyAoQWRtaW4pJywgcm9sZTogJ2FkbWluJyB9LFxyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gVXNlclNlbGVjdG9yKCkge1xyXG4gIGNvbnN0IHsgdXNlciwgbG9naW4sIGxvZ291dCB9ID0gdXNlVXNlcigpO1xyXG4gIGNvbnN0IHJvdXRlciA9IHVzZVJvdXRlcigpO1xyXG5cclxuICBjb25zdCBoYW5kbGVMb2dpbiA9ICh1c2VySWQpID0+IHtcclxuICAgIGxvZ2luKHVzZXJzW3VzZXJJZF0pO1xyXG4gICAgaWYgKHJvdXRlci5wYXRobmFtZSA9PT0gJy8nKSB7XHJcbiAgICAgIHJvdXRlci5wdXNoKCcvZGFzaGJvYXJkJyk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgaGFuZGxlTG9nb3V0ID0gKCkgPT4ge1xyXG4gICAgbG9nb3V0KCk7XHJcbiAgICByb3V0ZXIucHVzaCgnLycpO1xyXG4gIH07XHJcblxyXG4gIGlmIChyb3V0ZXIucGF0aG5hbWUgPT09ICcvJykge1xyXG4gICAgcmV0dXJuIG51bGw7IC8vIE5vIG1vc3RyYXIgZW4gbGEgcMOhZ2luYSBkZSBsb2dpblxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIChcclxuICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctZ3JheS04MDAgdGV4dC13aGl0ZSBwLTIgdGV4dC1zbSBmbGV4IGp1c3RpZnktY2VudGVyIGl0ZW1zLWNlbnRlciBnYXAtNFwiPlxyXG4gICAgICA8c3Bhbj5Vc3VhcmlvIGFjdHVhbDogPHN0cm9uZz57dXNlciA/IHVzZXIubmFtZSA6ICdOaW5ndW5vJ308L3N0cm9uZz48L3NwYW4+XHJcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBnYXAtMlwiPlxyXG4gICAgICAgIHtPYmplY3Qua2V5cyh1c2VycykubWFwKHVzZXJJZCA9PiAoXHJcbiAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICBrZXk9e3VzZXJJZH1cclxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gaGFuZGxlTG9naW4odXNlcklkKX1cclxuICAgICAgICAgICAgZGlzYWJsZWQ9e3VzZXI/LmlkID09PSB1c2VySWR9XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTIgcHktMSBiZy1ibHVlLTYwMCByb3VuZGVkLW1kIGhvdmVyOmJnLWJsdWUtNzAwIGRpc2FibGVkOmJnLWJsdWUtODAwIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZCB0ZXh0LXhzXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAge3VzZXJzW3VzZXJJZF0ubmFtZX1cclxuICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICkpfVxyXG4gICAgICAgIHt1c2VyICYmIChcclxuICAgICAgICAgIDxidXR0b24gb25DbGljaz17aGFuZGxlTG9nb3V0fSBjbGFzc05hbWU9XCJweC0yIHB5LTEgYmctcmVkLTYwMCByb3VuZGVkLW1kIGhvdmVyOmJnLXJlZC03MDAgdGV4dC14c1wiPlxyXG4gICAgICAgICAgICBDZXJyYXIgU2VzacOzblxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgKX1cclxuICAgICAgPC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICApO1xyXG59XHJcbiJdLCJuYW1lcyI6WyJ1c2VVc2VyIiwidXNlUm91dGVyIiwidXNlcnMiLCJ1c2VyMSIsImlkIiwibmFtZSIsInJvbGUiLCJ1c2VyMiIsInVzZXIzIiwiVXNlclNlbGVjdG9yIiwidXNlciIsImxvZ2luIiwibG9nb3V0Iiwicm91dGVyIiwiaGFuZGxlTG9naW4iLCJ1c2VySWQiLCJwYXRobmFtZSIsInB1c2giLCJoYW5kbGVMb2dvdXQiLCJkaXYiLCJjbGFzc05hbWUiLCJzcGFuIiwic3Ryb25nIiwiT2JqZWN0Iiwia2V5cyIsIm1hcCIsImJ1dHRvbiIsIm9uQ2xpY2siLCJkaXNhYmxlZCJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./components/UserSelector.js\n");

/***/ }),

/***/ "./pages/_app.js":
/*!***********************!*\
  !*** ./pages/_app.js ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _styles_globals_css__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../styles/globals.css */ \"./styles/globals.css\");\n/* harmony import */ var _styles_globals_css__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_styles_globals_css__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _components_UserContext__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../components/UserContext */ \"./components/UserContext.js\");\n/* harmony import */ var _components_UserSelector__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../components/UserSelector */ \"./components/UserSelector.js\");\n// pages/_app.js\n\n\n\n\nfunction MyApp({ Component, pageProps }) {\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_components_UserContext__WEBPACK_IMPORTED_MODULE_2__.UserProvider, {\n        children: [\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_components_UserSelector__WEBPACK_IMPORTED_MODULE_3__[\"default\"], {}, void 0, false, {\n                fileName: \"C:\\\\Users\\\\telot\\\\Downloads\\\\versiones_sistema\\\\sistema15\\\\pages\\\\_app.js\",\n                lineNumber: 9,\n                columnNumber: 7\n            }, this),\n            /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n                ...pageProps\n            }, void 0, false, {\n                fileName: \"C:\\\\Users\\\\telot\\\\Downloads\\\\versiones_sistema\\\\sistema15\\\\pages\\\\_app.js\",\n                lineNumber: 10,\n                columnNumber: 7\n            }, this)\n        ]\n    }, void 0, true, {\n        fileName: \"C:\\\\Users\\\\telot\\\\Downloads\\\\versiones_sistema\\\\sistema15\\\\pages\\\\_app.js\",\n        lineNumber: 8,\n        columnNumber: 5\n    }, this);\n}\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MyApp);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9wYWdlcy9fYXBwLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSxnQkFBZ0I7O0FBQ2U7QUFDMEI7QUFDSDtBQUV0RCxTQUFTRSxNQUFNLEVBQUVDLFNBQVMsRUFBRUMsU0FBUyxFQUFFO0lBQ3JDLHFCQUNFLDhEQUFDSixpRUFBWUE7OzBCQUNYLDhEQUFDQyxnRUFBWUE7Ozs7OzBCQUNiLDhEQUFDRTtnQkFBVyxHQUFHQyxTQUFTOzs7Ozs7Ozs7Ozs7QUFHOUI7QUFFQSxpRUFBZUYsS0FBS0EsRUFBQyIsInNvdXJjZXMiOlsid2VicGFjazovL3Npc3RlbWEtZ2VzdGlvbi1pbnZlbnRhcmlvLy4vcGFnZXMvX2FwcC5qcz9lMGFkIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHBhZ2VzL19hcHAuanNcbmltcG9ydCAnLi4vc3R5bGVzL2dsb2JhbHMuY3NzJztcbmltcG9ydCB7IFVzZXJQcm92aWRlciB9IGZyb20gJy4uL2NvbXBvbmVudHMvVXNlckNvbnRleHQnO1xuaW1wb3J0IFVzZXJTZWxlY3RvciBmcm9tICcuLi9jb21wb25lbnRzL1VzZXJTZWxlY3Rvcic7XG5cbmZ1bmN0aW9uIE15QXBwKHsgQ29tcG9uZW50LCBwYWdlUHJvcHMgfSkge1xuICByZXR1cm4gKFxuICAgIDxVc2VyUHJvdmlkZXI+XG4gICAgICA8VXNlclNlbGVjdG9yIC8+XG4gICAgICA8Q29tcG9uZW50IHsuLi5wYWdlUHJvcHN9IC8+XG4gICAgPC9Vc2VyUHJvdmlkZXI+XG4gICk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IE15QXBwO1xuIl0sIm5hbWVzIjpbIlVzZXJQcm92aWRlciIsIlVzZXJTZWxlY3RvciIsIk15QXBwIiwiQ29tcG9uZW50IiwicGFnZVByb3BzIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///./pages/_app.js\n");

/***/ }),

/***/ "./styles/globals.css":
/*!****************************!*\
  !*** ./styles/globals.css ***!
  \****************************/
/***/ (() => {



/***/ }),

/***/ "next/dist/compiled/next-server/pages.runtime.dev.js":
/*!**********************************************************************!*\
  !*** external "next/dist/compiled/next-server/pages.runtime.dev.js" ***!
  \**********************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/pages.runtime.dev.js");

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = require("react");

/***/ }),

/***/ "react-dom":
/*!****************************!*\
  !*** external "react-dom" ***!
  \****************************/
/***/ ((module) => {

"use strict";
module.exports = require("react-dom");

/***/ }),

/***/ "react/jsx-dev-runtime":
/*!****************************************!*\
  !*** external "react/jsx-dev-runtime" ***!
  \****************************************/
/***/ ((module) => {

"use strict";
module.exports = require("react/jsx-dev-runtime");

/***/ }),

/***/ "react/jsx-runtime":
/*!************************************!*\
  !*** external "react/jsx-runtime" ***!
  \************************************/
/***/ ((module) => {

"use strict";
module.exports = require("react/jsx-runtime");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("stream");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("zlib");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/@swc"], () => (__webpack_exec__("./pages/_app.js")));
module.exports = __webpack_exports__;

})();