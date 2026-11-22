using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Exceptions;

namespace Pakpost.Api.Middlewares;

public sealed class GlobalExceptionMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            if (context.Response.HasStarted)
            {
                logger.LogError(ex, "Request failed after the response started");
                throw;
            }

            var (statusCode, response) = ApiExceptionMapper.MapException(ex);

            if (ApiExceptionMapper.IsTemporaryDatabaseFailure(ex))
            {
                if (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method))
                    context.Response.Headers["Retry-After"] = "3";
                logger.LogWarning(
                    "PostgreSQL temporarily unavailable; {ExceptionType} {SqlState}",
                    ex.GetType().Name,
                    ApiExceptionMapper.GetSqlState(ex));
            }
            else if (ex is DbUpdateConcurrencyException)
            {
                logger.LogWarning("Concurrent update conflict");
            }
            else if (ApiExceptionMapper.IsDatabaseConflict(ex))
            {
                logger.LogWarning("Database mutation conflict {SqlState}", ApiExceptionMapper.GetSqlState(ex));
            }
            else if (ex is not ValidationException and not AppException)
            {
                logger.LogError(ex, "Unhandled request error");
            }

            context.Response.StatusCode = statusCode;
            await context.Response.WriteAsJsonAsync(response);
        }
    }

}
