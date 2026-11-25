namespace Pakpost.Api.Middlewares;

public sealed class PrivateApiCacheMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;

        if (path.StartsWithSegments("/api/workspaces") ||
            path.StartsWithSegments("/api/auth") ||
            path.StartsWithSegments("/api/desktop-auth") ||
            path.StartsWithSegments("/api/proxy") ||
            path.StartsWithSegments("/hubs/workspace") ||
            path.StartsWithSegments("/api/invitations") ||
            path.StartsWithSegments("/api/admin"))
        {
            context.Response.Headers.CacheControl = "no-store, private";
            context.Response.Headers.Pragma = "no-cache";
        }

        await next(context);
    }
}
