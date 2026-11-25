using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Pakpost.Api.Security;
using Pakpost.Api.Middlewares;

namespace Pakpost.UnitTests.Api;

public sealed class RealtimeSecurityMiddlewareTests
{
    [Theory]
    [InlineData("https://example.test", true)]
    [InlineData("https://other.test", false)]
    [InlineData("https://user@example.test", false)]
    [InlineData("https://example.test/path", false)]
    [InlineData("", false)]
    public async Task WebSocketRequiresTrustedOrigin(string origin, bool accepted)
    {
        var context = new DefaultHttpContext();
        context.Request.Scheme = "https";
        context.Request.Host = new HostString("example.test");
        context.Request.Path = "/hubs/workspace";
        context.Request.Method = "GET";
        context.Request.Headers.Upgrade = "websocket";
        context.Request.Headers.Origin = origin;
        var called = false;
        var middleware = new BrowserSessionSecurityMiddleware(_ => { called = true; return Task.CompletedTask; }, new ConfigurationBuilder().Build());
        await middleware.InvokeAsync(context);
        Assert.Equal(accepted, called);
        Assert.Equal(accepted ? 200 : 403, context.Response.StatusCode);
    }

    [Theory]
    [InlineData("/api/desktop-auth/poll")]
    [InlineData("/api/proxy/send")]
    [InlineData("/hubs/workspace/negotiate")]
    [InlineData("/hubs/workspace")]
    public async Task SensitiveTransportResponsesAreNotCacheable(string path)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        var middleware = new PrivateApiCacheMiddleware(_ => Task.CompletedTask);
        await middleware.InvokeAsync(context);
        Assert.Equal("no-store, private", context.Response.Headers.CacheControl.ToString());
    }
}
