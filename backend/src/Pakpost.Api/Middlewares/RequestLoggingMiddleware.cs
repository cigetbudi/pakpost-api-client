using System.Diagnostics;
using Microsoft.AspNetCore.Routing;

namespace Pakpost.Api.Middlewares;

public sealed class RequestLoggingMiddleware(
    RequestDelegate next,
    ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var watch = Stopwatch.StartNew();

        try
        {
            await next(context);
        }
        finally
        {
            if (!context.Request.Path.StartsWithSegments("/health"))
            {
                var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "unmatched";
                var status = context.Response.StatusCode;

                if (status >= 500)
                    logger.LogWarning("HTTP {Method} {Route} completed {StatusCode} in {ElapsedMs} ms",
                        context.Request.Method, route, status, watch.ElapsedMilliseconds);
                else
                    logger.LogInformation("HTTP {Method} {Route} completed {StatusCode} in {ElapsedMs} ms",
                        context.Request.Method, route, status, watch.ElapsedMilliseconds);
            }
        }
    }
}
