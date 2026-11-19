namespace Pakpost.Api.Middlewares;

public sealed class RequestCorrelationMiddleware(
    RequestDelegate next,
    ILogger<RequestCorrelationMiddleware> logger)
{
    public const string HeaderName = "X-Request-ID";

    public async Task InvokeAsync(HttpContext context)
    {
        var supplied = context.Request.Headers[HeaderName].ToString();
        var requestId = IsSafeRequestId(supplied) ? supplied : Guid.NewGuid().ToString("N");

        context.TraceIdentifier = requestId;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = requestId;
            return Task.CompletedTask;
        });

        using (logger.BeginScope(new Dictionary<string, object> { ["RequestId"] = requestId }))
            await next(context);
    }

    private static bool IsSafeRequestId(string value) =>
        value.Length is >= 1 and <= 64 && value.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_' or '.');
}
