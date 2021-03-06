'use strict';

angular.module('meetadevApp', [
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'btford.socket-io',
  'ui.router',
  'ui.bootstrap',
  'flash',
  'ui.select',
  'ui.gravatar',
  'truncate',
  'angularMoment'
])
  .config(function ($stateProvider, $urlRouterProvider, $locationProvider, $httpProvider, uiSelectConfig,gravatarServiceProvider) {
    $urlRouterProvider
      .otherwise('/');

    $locationProvider.html5Mode(true);
    $httpProvider.interceptors.push('authInterceptor');

    uiSelectConfig.theme = 'bootstrap';

    gravatarServiceProvider.defaults = {
      size     : 100,
      "default": 'mm'  // Mystery man as default for missing avatars
    };
    gravatarServiceProvider.secure = false;
  })

  .factory('authInterceptor', function ($rootScope, $q, $cookieStore, $location) {
    return {
      // Add authorization token to headers
      request: function (config) {
        config.headers = config.headers || {};
        if ($cookieStore.get('token')) {
          config.headers.Authorization = 'Bearer ' + $cookieStore.get('token');
        }
        return config;
      },

      // Intercept 401s and redirect you to login
      responseError: function(response) {
        if(response.status === 401) {
          $location.path('/login');
          // remove any stale tokens
          $cookieStore.remove('token');
          return $q.reject(response);
        }
        else {
          return $q.reject(response);
        }
      }
    };
  })

  .run(function ($rootScope, $location, Auth, $state) {
    // Redirect to login if route requires auth and you're not logged in
    $rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
      Auth.isLoggedInAsync(function(loggedIn) {
        if (toState.data && toState.data.authenticate && !loggedIn) {
          event.preventDefault();
          $state.go('login');
        }
      });
    });
  });
