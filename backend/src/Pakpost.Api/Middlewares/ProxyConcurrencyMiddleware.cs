namespace Pakpost.Api.Middlewares;

public sealed class ProxyConcurrencyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly SemaphoreSlim _slots;

    public ProxyConcurrencyMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;

        var maxConcurrent = Math.Clamp(
            configuration.GetValue("Proxy:MaxConcurrentRequests", 8),
            1,
            64);

        _slots = new SemaphoreSlim(maxConcurrent, maxConcurrent);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!string.Equals(
            context.Request.Path.Value,
            "/api/proxy/send",
            StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        if (!_slots.Wait(0))
        {
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            await context.Response.WriteAsJsonAsync(new
            {
                message = "Proxy is busy; retry shortly"
            });
            return;
        }

        try
        {
            await _next(context);
        }
        finally
        {
            _slots.Release();
        }
    }
}
