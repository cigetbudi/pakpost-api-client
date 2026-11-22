using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Pakpost.Api.Middlewares;

namespace Pakpost.UnitTests;

public sealed class RequestCorrelationMiddlewareTests
{
    [Theory]
    [InlineData("frontend-abc.123", "frontend-abc.123")]
    [InlineData("bad value with spaces", null)]
    [InlineData("bad/value", null)]
    public async Task CorrelationIdIsAcceptedOnlyWhenSafe(string supplied, string? expected)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers[RequestCorrelationMiddleware.HeaderName] = supplied;

        var middleware = new RequestCorrelationMiddleware(
            async http =>
            {
                await http.Response.WriteAsync("ok");
            },
            NullLogger<RequestCorrelationMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        if (expected is null)
            Assert.NotEqual(supplied, context.TraceIdentifier);
        else
            Assert.Equal(expected, context.TraceIdentifier);

        Assert.True(context.TraceIdentifier.Length is >= 1 and <= 64);
    }

    [Fact]
    public async Task MissingCorrelationIdGetsGenerated()
    {
        var context = new DefaultHttpContext();
        var middleware = new RequestCorrelationMiddleware(
            _ => Task.CompletedTask,
            NullLogger<RequestCorrelationMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        Assert.True(Guid.TryParseExact(context.TraceIdentifier, "N", out _));
    }
}
